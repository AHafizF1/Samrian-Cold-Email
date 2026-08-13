import type { ConnectionTestResult } from "../../../lib/email-connectors/types";
import type { MailboxConnector } from "../jobs/types";
import type { MailboxId, MailboxRecord, NotificationRepo, OrgId, UserId } from "../ports";
import { notifyMailboxDisconnected } from "./notifications";

export type MailboxFailureKind = "auth" | "rate-limit" | "quota" | "network" | "config" | "unknown";

export type MailboxFailure = {
  kind: MailboxFailureKind;
  status: "active" | "disconnected" | "limit_reached";
  retryable: boolean;
  requiresReconnect: boolean;
  providerLimitCode?: string;
  message: string;
};

export type CheckMailboxResult =
  | { status: "healthy"; mailboxId: MailboxId }
  | {
      status: "disconnected" | "limit-reached" | "warning";
      mailboxId: MailboxId;
      issue: string;
      requiresReconnect: boolean;
      providerLimitCode?: string;
    }
  | { status: "missing"; mailboxId: MailboxId };

export type CheckMailboxDeps = {
  now(): number;
  notifications?: NotificationRepo;
  repos?: {
    mailboxes: {
      getById(id: MailboxId, orgId: OrgId): Promise<MailboxRecord | null>;
      recordConnectionSuccess?(id: MailboxId, orgId: OrgId, at: number): Promise<void>;
      recordConnectionFailure?(
        id: MailboxId,
        orgId: OrgId,
        failure: MailboxFailure,
        at: number
      ): Promise<void>;
    };
  };
  connectorForMailbox(mailbox: MailboxRecord): Promise<MailboxConnector>;
  transaction?: <T>(
    operation: (repos: NonNullable<CheckMailboxDeps["repos"]>) => Promise<T>
  ) => Promise<T>;
};

export type ReconnectMailboxInput = {
  mailboxId: MailboxId;
  orgId: OrgId;
  encryptedRefreshToken?: string;
  encryptedAccessToken?: string;
  encryptedPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  imapHost?: string;
  imapPort?: number;
  username?: string;
  tokenExpiresAt?: Date;
  userEmail?: string;
};

export type ReconnectMailboxDeps = {
  repos: {
    mailboxes: {
      reconnect(
        id: MailboxId,
        orgId: OrgId,
        input: Omit<ReconnectMailboxInput, "mailboxId" | "orgId"> & { clearHealth: true }
      ): Promise<void>;
    };
  };
};

export type RemoveMailboxDeps = {
  now(): number;
  revokeToken?(mailboxId: MailboxId, orgId: OrgId): Promise<void>;
  repos?: {
    mailboxes: {
      getById(id: MailboxId, orgId: OrgId): Promise<MailboxRecord | null>;
      countActiveCampaignLinks?(id: MailboxId, orgId: OrgId): Promise<number>;
      disableCampaignLinks?(id: MailboxId, orgId: OrgId): Promise<number>;
      archive?(id: MailboxId, orgId: OrgId, at: number): Promise<void>;
    };
    audit?: {
      create(input: {
        orgId: OrgId;
        userId: UserId;
        action: string;
        details: string;
      }): Promise<unknown>;
    };
  };
  transaction?: <T>(
    operation: (repos: NonNullable<RemoveMailboxDeps["repos"]>) => Promise<T>
  ) => Promise<T>;
};

export async function checkMailbox(
  input: { mailboxId: MailboxId; orgId: OrgId },
  deps: CheckMailboxDeps
): Promise<CheckMailboxResult> {
  const run =
    deps.transaction ??
    ((operation) => {
      if (!deps.repos) throw new Error("Mailbox repositories are not configured");
      return operation(deps.repos);
    });
  const mailbox = await run((repos) => repos.mailboxes.getById(input.mailboxId, input.orgId));
  if (!mailbox) return { status: "missing", mailboxId: input.mailboxId };

  const connector = await deps.connectorForMailbox(mailbox);
  try {
    const health = await connector.testConnection?.();
    if (!health || health.ok) {
      await run(async (repos) => {
        await repos.mailboxes.recordConnectionSuccess?.(input.mailboxId, input.orgId, deps.now());
      });
      return { status: "healthy", mailboxId: input.mailboxId };
    }

    const failure = classifyMailboxError(health);
    await run(async (repos) => {
      await repos.mailboxes.recordConnectionFailure?.(
        input.mailboxId,
        input.orgId,
        failure,
        deps.now()
      );
    });
    await notifyOnTransition(deps.notifications, mailbox, failure);
    return toCheckResult(input.mailboxId, failure);
  } finally {
    await connector.close();
  }
}

export function classifyMailboxError(error: unknown): MailboxFailure {
  if (isConnectionTestResult(error)) {
    if (error.requiresReconnect) {
      return {
        kind: "auth",
        status: "disconnected",
        retryable: false,
        requiresReconnect: true,
        message: error.error ?? "Mailbox reconnect required",
      };
    }
    return classifyMessage(error.error ?? "Mailbox connection failed");
  }

  const message = error instanceof Error ? error.message : String(error);
  return classifyMessage(message);
}

export async function reconnectMailbox(
  input: ReconnectMailboxInput,
  deps: ReconnectMailboxDeps
): Promise<{ status: "reconnected" }> {
  await deps.repos.mailboxes.reconnect(input.mailboxId, input.orgId, {
    encryptedRefreshToken: input.encryptedRefreshToken,
    encryptedAccessToken: input.encryptedAccessToken,
    encryptedPassword: input.encryptedPassword,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    imapHost: input.imapHost,
    imapPort: input.imapPort,
    username: input.username,
    tokenExpiresAt: input.tokenExpiresAt,
    userEmail: input.userEmail,
    clearHealth: true,
  });
  return { status: "reconnected" };
}

export async function removeMailbox(
  input: { mailboxId: MailboxId; orgId: OrgId; userId?: UserId; force?: boolean },
  deps: RemoveMailboxDeps
): Promise<{ status: "archived"; disabledLinks: number } | { status: "missing" }> {
  const run =
    deps.transaction ??
    ((operation) => {
      if (!deps.repos) throw new Error("Mailbox repositories are not configured");
      return operation(deps.repos);
    });
  const prepared = await run(async (repos) => {
    const mailbox = await repos.mailboxes.getById(input.mailboxId, input.orgId);
    if (!mailbox) return null;
    const activeLinks =
      (await repos.mailboxes.countActiveCampaignLinks?.(input.mailboxId, input.orgId)) ?? 0;
    if (activeLinks > 0 && !input.force) {
      throw new Error("Mailbox is linked to active campaigns. Force delete to archive it.");
    }
    const disabledLinks =
      (await repos.mailboxes.disableCampaignLinks?.(input.mailboxId, input.orgId)) ?? 0;
    return { disabledLinks };
  });
  const mailbox = prepared;
  if (!mailbox) return { status: "missing" };

  await deps.revokeToken?.(input.mailboxId, input.orgId).catch(() => undefined);
  await run(async (repos) => {
    await repos.mailboxes.archive?.(input.mailboxId, input.orgId, deps.now());
    if (input.userId) {
      await repos.audit?.create({
        orgId: input.orgId,
        userId: input.userId,
        action: "mailbox.archived",
        details: `Archived mailbox ${input.mailboxId}; disabled ${prepared.disabledLinks} campaign links`,
      });
    }
  });
  return { status: "archived", disabledLinks: prepared.disabledLinks };
}

function classifyMessage(message: string): MailboxFailure {
  const lower = message.toLowerCase();
  if (
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("throttle")
  ) {
    return {
      kind: "rate-limit",
      status: "limit_reached",
      retryable: true,
      requiresReconnect: false,
      providerLimitCode: "rate-limit",
      message,
    };
  }
  if (lower.includes("quota") || lower.includes("limit exceeded")) {
    return {
      kind: "quota",
      status: "limit_reached",
      retryable: true,
      requiresReconnect: false,
      providerLimitCode: "quota",
      message,
    };
  }
  if (
    lower.includes("auth") ||
    lower.includes("invalid login") ||
    lower.includes("invalid credential") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("535")
  ) {
    return {
      kind: "auth",
      status: "disconnected",
      retryable: false,
      requiresReconnect: true,
      message,
    };
  }
  if (lower.includes("host") || lower.includes("port") || lower.includes("configuration")) {
    return {
      kind: "config",
      status: "disconnected",
      retryable: false,
      requiresReconnect: true,
      message,
    };
  }
  if (lower.includes("timeout") || lower.includes("network") || lower.includes("econn")) {
    return {
      kind: "network",
      status: "active",
      retryable: true,
      requiresReconnect: false,
      message,
    };
  }
  return {
    kind: "unknown",
    status: "active",
    retryable: true,
    requiresReconnect: false,
    message,
  };
}

function toCheckResult(mailboxId: MailboxId, failure: MailboxFailure): CheckMailboxResult {
  if (failure.status === "disconnected") {
    return {
      status: "disconnected",
      mailboxId,
      issue: failure.message,
      requiresReconnect: true,
    };
  }
  if (failure.status === "limit_reached") {
    return {
      status: "limit-reached",
      mailboxId,
      issue: failure.message,
      requiresReconnect: false,
      providerLimitCode: failure.providerLimitCode,
    };
  }
  return {
    status: "warning",
    mailboxId,
    issue: failure.message,
    requiresReconnect: false,
  };
}

async function notifyOnTransition(
  notifications: NotificationRepo | undefined,
  mailbox: MailboxRecord,
  failure: MailboxFailure
) {
  if (failure.status !== "disconnected" || mailbox.status === "disconnected") return;
  await notifyMailboxDisconnected(notifications, {
    orgId: mailbox.orgId,
    mailboxId: mailbox.id,
    email: mailbox.email,
  });
}

function isConnectionTestResult(value: unknown): value is ConnectionTestResult {
  return Boolean(value && typeof value === "object" && "ok" in value);
}
