import type {
  AssignmentId,
  CampaignId,
  ContactId,
  DispatchAssignmentRecord,
  DispatchMailboxRecord,
  JobQueue,
  MailboxId,
  OrgId,
} from "../ports";
import { getObservabilityContext } from "../observability";
import { getMailboxCapacity } from "../modules/ramp";
import type { LimitGuard } from "../modules/limits";
import { DISPATCH_BATCH_LIMIT, getJitterMs, isInSendWindow, nextWindowStart } from "./schedule";

export type DueAssignment = DispatchAssignmentRecord;

export type DispatchMailbox = DispatchMailboxRecord;

export type DispatchRepos = {
  assignments: {
    listDueForDispatch(input: { now: number; limit: number }): Promise<DueAssignment[]>;
    markEnqueued(id: AssignmentId, orgId: OrgId, at: number): Promise<void>;
    deferUntil(id: AssignmentId, orgId: OrgId, at: number): Promise<void>;
  };
  campaignMailboxes: {
    listDispatchMailboxes(campaignId: CampaignId, orgId: OrgId): Promise<DispatchMailbox[]>;
    updateLastUsed(
      campaignId: CampaignId,
      mailboxId: MailboxId,
      orgId: OrgId,
      at: number
    ): Promise<void>;
    reserveCapacity(input: {
      mailboxId: MailboxId;
      assignmentId: AssignmentId;
      stepNumber: number;
      orgId: OrgId;
      limit: number;
      now: number;
    }): Promise<boolean>;
    releaseCapacity(input: {
      mailboxId: MailboxId;
      assignmentId: AssignmentId;
      stepNumber: number;
      orgId: OrgId;
    }): Promise<void>;
  };
  blocklist: {
    isBlocked(email: string, orgId: OrgId): Promise<boolean>;
  };
};

type DispatchBase = {
  queue: JobQueue;
  now?: () => number;
  random?: () => number;
  limit?: number;
  limits?: LimitGuard;
};

export type DispatchDeps = DispatchBase & {
  repos: DispatchRepos;
  transaction?: <T>(operation: (repos: DispatchRepos) => Promise<T>) => Promise<T>;
};

type TransactionDispatchDeps = DispatchBase & {
  repos?: never;
  transaction: <T>(operation: (repos: DispatchRepos) => Promise<T>) => Promise<T>;
};

export type DispatchResult = {
  enqueued: number;
  deferred: number;
  skipped: number;
  missingCapacity: number;
  stale: number;
  limit: number;
};

export async function dispatchDueSends(
  deps: DispatchDeps | TransactionDispatchDeps
): Promise<DispatchResult> {
  const now = deps.now?.() ?? Date.now();
  const limit = deps.limit ?? DISPATCH_BATCH_LIMIT;
  const result: DispatchResult = {
    enqueued: 0,
    deferred: 0,
    skipped: 0,
    missingCapacity: 0,
    stale: 0,
    limit,
  };
  const run =
    deps.transaction ??
    ((operation) => {
      if (!deps.repos) throw new Error("Dispatch repositories are not configured");
      return operation(deps.repos);
    });
  const due = await run((repos) => repos.assignments.listDueForDispatch({ now, limit }));

  for (const item of due.slice(0, limit)) {
    if (shouldSkip(item)) {
      result.skipped += 1;
      continue;
    }

    if (await run((repos) => repos.blocklist.isBlocked(item.contactEmail, item.orgId))) {
      result.skipped += 1;
      continue;
    }

    if (
      !isInSendWindow({
        schedule: item.campaignSchedule as never,
        contactTimezone: item.contactTimezone,
        now,
      })
    ) {
      await run((repos) =>
        repos.assignments.deferUntil(
          item.assignmentId,
          item.orgId,
          nextWindowStart({
            schedule: item.campaignSchedule as never,
            contactTimezone: item.contactTimezone,
            now,
          })
        )
      );
      result.deferred += 1;
      continue;
    }

    const mailbox = await run(async (repos) =>
      pickMailbox(
        await repos.campaignMailboxes.listDispatchMailboxes(item.campaignId, item.orgId),
        now
      )
    );
    if (!mailbox) {
      result.missingCapacity += 1;
      continue;
    }

    if (deps.limits) {
      const backpressure = await deps.limits.checkSubject({
        operationId: "jobs.dispatch",
        subjectType: "worker",
        subject: item.orgId,
      });
      if (!backpressure.allowed) {
        await run((repos) =>
          repos.assignments.deferUntil(item.assignmentId, item.orgId, backpressure.resetAt)
        );
        result.deferred += 1;
        continue;
      }
    }

    const available = await run((repos) =>
      repos.campaignMailboxes.reserveCapacity({
        mailboxId: mailbox.mailboxId,
        assignmentId: item.assignmentId,
        stepNumber: item.currentStep,
        orgId: item.orgId,
        limit: capacity(mailbox).campaignLimit,
        now,
      })
    );
    if (!available) {
      result.missingCapacity += 1;
      continue;
    }
    try {
      await deps.queue.enqueueCampaignSend(
        {
          assignmentId: item.assignmentId,
          campaignId: item.campaignId,
          contactId: item.contactId,
          mailboxId: mailbox.mailboxId,
          orgId: item.orgId,
          stepNumber: item.currentStep,
        },
        {
          delayMs: getJitterMs({ random: deps.random }),
          idempotencyKey: `${item.assignmentId}:${item.currentStep}`,
          metadata: queueMetadata(),
        }
      );
    } catch (error) {
      await run((repos) =>
        repos.campaignMailboxes.releaseCapacity({
          mailboxId: mailbox.mailboxId,
          assignmentId: item.assignmentId,
          stepNumber: item.currentStep,
          orgId: item.orgId,
        })
      );
      throw error;
    }
    await run(async (repos) => {
      await repos.assignments.markEnqueued(item.assignmentId, item.orgId, now);
      await repos.campaignMailboxes.updateLastUsed(
        item.campaignId,
        mailbox.mailboxId,
        item.orgId,
        now
      );
    });
    result.enqueued += 1;
  }

  return result;
}

function queueMetadata() {
  const context = getObservabilityContext();
  if (!context.requestId && !context.correlationId) return undefined;
  return {
    requestId: context.requestId,
    correlationId: context.correlationId,
  };
}

function shouldSkip(item: DueAssignment): boolean {
  return (
    item.status !== "active" ||
    item.campaignStatus !== "active" ||
    item.contactBounceStatus === "hard" ||
    item.contactVerificationStatus === "invalid" ||
    item.currentStep >= item.campaignSteps.length
  );
}

function pickMailbox(mailboxes: DispatchMailbox[], now: number): DispatchMailbox | null {
  return (
    mailboxes
      .filter((mailbox) => canUseMailbox(mailbox, now))
      .sort((left, right) => {
        const byUse = capacity(left).utilization - capacity(right).utilization;
        if (byUse !== 0) return byUse;
        return (left.lastUsedAt ?? 0) - (right.lastUsedAt ?? 0);
      })[0] ?? null
  );
}

function canUseMailbox(mailbox: DispatchMailbox, now: number): boolean {
  if (mailbox.providerLimitResetAt && mailbox.providerLimitResetAt > now) return false;
  return capacity(mailbox).available > 0;
}

function capacity(mailbox: DispatchMailbox) {
  return getMailboxCapacity({
    providerLimit: mailbox.providerSafeLimit ?? mailbox.dailySendLimit,
    userLimit: mailbox.dailySendLimit,
    rampEnabled: mailbox.rampEnabled,
    rampLimit: mailbox.rampCurrentLimit,
    sentToday: mailbox.emailsSentToday,
    reserved: mailbox.reservedSends,
    replyReserve: mailbox.replyReserve,
  });
}
