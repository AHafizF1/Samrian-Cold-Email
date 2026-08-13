import { evaluateRamp, type RampDecision, type RampStatus } from "../modules/ramp";
import { notifyMailboxRamp } from "../modules/notifications";
import { logger } from "../observability/runtime";
import type { MailboxId, MailboxRecord, NotificationRepo, OrgId } from "../ports";

export type RampEvidence = {
  sent: number;
  failed: number;
  hardBounces: number;
  softBounces: number;
  unsubscribes: number;
  domainStatus?: "pass" | "warn" | "unknown" | "fail";
};

export type RampRepos = {
  getEvidence(mailboxId: MailboxId, orgId: OrgId, since: number): Promise<RampEvidence>;
  update(
    mailboxId: MailboxId,
    orgId: OrgId,
    decision: RampDecision,
    expectedNextCheckAt?: number
  ): Promise<boolean>;
  audit?(input: {
    orgId: OrgId;
    mailboxId: MailboxId;
    priorStatus: RampStatus;
    status: RampStatus;
    priorLimit: number;
    currentLimit: number;
    reason: string;
  }): Promise<void>;
  notifications?: NotificationRepo;
};

export type RampDeps = {
  listDue(now: number, limit: number): Promise<MailboxRecord[]>;
  transaction<T>(orgId: OrgId, operation: (repos: RampRepos) => Promise<T>): Promise<T>;
  now?: () => number;
  limit?: number;
};

export type RampResult = {
  advanced: number;
  held: number;
  reduced: number;
  paused: number;
  recovering: number;
  unchanged: number;
  failed: number;
  limit: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function evaluateMailboxRamps(deps: RampDeps): Promise<RampResult> {
  const now = deps.now?.() ?? Date.now();
  const limit = deps.limit ?? 100;
  const result: RampResult = {
    advanced: 0,
    held: 0,
    reduced: 0,
    paused: 0,
    recovering: 0,
    unchanged: 0,
    failed: 0,
    limit,
  };
  const due = (await deps.listDue(now, limit)).slice(0, limit);

  for (const mailbox of due) {
    try {
      await deps.transaction(mailbox.orgId, async (repos) => {
        const evidence = await repos.getEvidence(mailbox.id, mailbox.orgId, now - 7 * DAY_MS);
        const previousStatus = toRampStatus(mailbox.rampStatus);
        const previousLimit = mailbox.rampCurrentLimit ?? 5;
        const decision = evaluateRamp({
          enabled: mailbox.rampEnabled ?? false,
          status: previousStatus,
          mailboxStatus: mailbox.status ?? "active",
          startedAt: mailbox.rampStartedAt,
          currentLimit: previousLimit,
          targetLimit: mailbox.rampTargetLimit ?? 30,
          increment: mailbox.rampIncrement ?? 5,
          nextCheckAt: mailbox.rampNextCheckAt,
          providerLimitResetAt: mailbox.providerLimitResetAt,
          archived: Boolean(mailbox.archivedAt),
          now,
          ...evidence,
        });
        const accepted = await repos.update(
          mailbox.id,
          mailbox.orgId,
          decision,
          mailbox.rampNextCheckAt
        );
        if (!accepted) {
          result.unchanged += 1;
          return;
        }
        if (changed(previousStatus, previousLimit, decision)) {
          const fields = {
            orgId: mailbox.orgId,
            mailboxId: mailbox.id,
            priorStatus: previousStatus,
            rampStatus: decision.status,
            priorLimit: previousLimit,
            currentLimit: decision.currentLimit,
            reason: decision.reason,
            evidenceDays: 7,
          };
          if (decision.status === "paused" || decision.status === "reduced") {
            logger.warn("mailbox.ramp_changed", fields);
          } else {
            logger.info("mailbox.ramp_changed", fields);
          }
          if (
            decision.status === "paused" ||
            decision.status === "reduced" ||
            decision.status === "recovering"
          ) {
            await notifyMailboxRamp(repos.notifications, {
              orgId: mailbox.orgId,
              mailboxId: mailbox.id,
              email: mailbox.email,
              status: decision.status,
              reason: decision.reason,
              currentLimit: decision.currentLimit,
            });
          }
          await repos.audit?.({
            orgId: mailbox.orgId,
            mailboxId: mailbox.id,
            priorStatus: previousStatus,
            status: decision.status,
            priorLimit: previousLimit,
            currentLimit: decision.currentLimit,
            reason: decision.reason,
          });
        }
        count(result, previousStatus, previousLimit, decision);
      });
    } catch (error) {
      logger.error("mailbox.ramp_failed", {
        orgId: mailbox.orgId,
        mailboxId: mailbox.id,
        error,
      });
      result.failed += 1;
    }
  }

  return result;
}

function changed(
  previousStatus: RampStatus,
  previousLimit: number,
  decision: RampDecision
): boolean {
  return decision.status !== previousStatus || decision.currentLimit !== previousLimit;
}

function count(
  result: RampResult,
  previousStatus: RampStatus,
  previousLimit: number,
  decision: RampDecision
) {
  if (decision.status === "held") result.held += 1;
  else if (decision.status === "reduced") result.reduced += 1;
  else if (decision.status === "paused") result.paused += 1;
  else if (decision.status === "recovering") result.recovering += 1;
  else if (decision.currentLimit > previousLimit) result.advanced += 1;
  else if (decision.status === previousStatus && decision.currentLimit === previousLimit) {
    result.unchanged += 1;
  } else {
    result.unchanged += 1;
  }
}

function toRampStatus(value?: string): RampStatus {
  if (
    value === "disabled" ||
    value === "pending" ||
    value === "ramping" ||
    value === "ready" ||
    value === "held" ||
    value === "reduced" ||
    value === "paused" ||
    value === "recovering"
  ) {
    return value;
  }
  return "pending";
}
