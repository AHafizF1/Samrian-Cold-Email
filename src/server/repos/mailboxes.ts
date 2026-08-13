import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { campaignMailboxes, mailboxes, sendReservations } from "../db/schema";
import type { DbExecutor } from "../db/tx";
import type { MailboxFailure } from "../modules/mailboxes";
import type { AssignmentId, MailboxId, MailboxRecord, OrgId } from "../ports";
import type { RampDecision, RampStatus } from "../modules/ramp";
import { newId } from "./ids";

export type MailboxProvider = "smtp" | "puzzle" | "mailpool" | "google" | "microsoft";
export type MailboxStatus = "active" | "disconnected" | "limit_reached";

export type CreateMailboxInput = {
  id?: MailboxId;
  orgId: OrgId;
  name: string;
  provider: MailboxProvider;
  userEmail: string;
  dailySendLimit: number;
  status?: MailboxStatus;
  smtpHost?: string;
  smtpPort?: number;
  imapHost?: string;
  imapPort?: number;
  username?: string;
  encryptedPassword?: string;
  encryptedRefreshToken?: string;
  encryptedAccessToken?: string;
  tokenExpiresAt?: Date;
  rampEnabled?: boolean;
  rampCurrentLimit?: number;
  rampTargetLimit?: number;
};

export type ReconnectMailboxInput = {
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
  clearHealth?: boolean;
};

export type MailboxListItem = {
  _id: string;
  name: string;
  provider: MailboxProvider;
  userEmail?: string;
  username?: string;
  status: MailboxStatus;
  dailySendLimit: number;
  emailsSentToday: number;
  lastConnectionTestAt?: number;
  lastConnectionError?: string;
  lastTokenRefreshAt?: number;
  lastTokenRefreshError?: string;
  providerLimitCode?: string;
  providerLimitResetAt?: number;
  rampEnabled: boolean;
  rampStatus: RampStatus;
  rampCurrentLimit?: number;
  rampTargetLimit: number;
  rampNextCheckAt?: number;
  rampReason?: string;
  effectiveDailyLimit: number;
  availableToday: number;
};

export class PostgresMailboxRepo {
  constructor(private readonly db: DbExecutor) {}

  async create(input: CreateMailboxInput): Promise<MailboxRecord> {
    const [row] = await this.db
      .insert(mailboxes)
      .values({
        id: input.id ?? newId("mailbox"),
        orgId: input.orgId,
        name: input.name,
        provider: input.provider,
        userEmail: input.userEmail,
        dailySendLimit: input.dailySendLimit,
        status: input.status ?? "active",
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        username: input.username,
        encryptedPassword: input.encryptedPassword,
        encryptedRefreshToken: input.encryptedRefreshToken,
        encryptedAccessToken: input.encryptedAccessToken,
        tokenExpiresAt: input.tokenExpiresAt,
        rampEnabled: input.rampEnabled,
        rampStatus: input.rampEnabled ? "pending" : "disabled",
        rampCurrentLimit: input.rampCurrentLimit,
        rampTargetLimit: input.rampTargetLimit,
        rampStartedAt: input.rampEnabled ? new Date() : undefined,
        rampNextCheckAt: input.rampEnabled ? new Date() : undefined,
      })
      .returning();

    return toMailbox(row);
  }

  async getById(id: MailboxId, orgId: OrgId): Promise<MailboxRecord | null> {
    const [row] = await this.db
      .select()
      .from(mailboxes)
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId), isNull(mailboxes.archivedAt)))
      .limit(1);
    return row ? toMailbox(row) : null;
  }

  async getRawById(id: MailboxId, orgId: OrgId) {
    const [row] = await this.db
      .select()
      .from(mailboxes)
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId), isNull(mailboxes.archivedAt)))
      .limit(1);
    return row ?? null;
  }

  async list(orgId: OrgId): Promise<MailboxRecord[]> {
    const rows = await this.db
      .select()
      .from(mailboxes)
      .where(and(eq(mailboxes.orgId, orgId), isNull(mailboxes.archivedAt)));
    return rows.map(toMailbox);
  }

  async listItems(orgId: OrgId, limit = 50): Promise<MailboxListItem[]> {
    const rows = await this.db
      .select()
      .from(mailboxes)
      .where(and(eq(mailboxes.orgId, orgId), isNull(mailboxes.archivedAt)))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map((row) => ({
      _id: row.id,
      name: row.name,
      provider: row.provider,
      userEmail: row.userEmail ?? undefined,
      username: row.username ?? undefined,
      status: row.status,
      dailySendLimit: row.dailySendLimit,
      emailsSentToday: row.emailsSentToday,
      lastConnectionTestAt: row.lastConnectionTestAt?.getTime(),
      lastConnectionError: row.lastConnectionError ?? undefined,
      lastTokenRefreshAt: row.lastTokenRefreshAt?.getTime(),
      lastTokenRefreshError: row.lastTokenRefreshError ?? undefined,
      providerLimitCode: row.providerLimitCode ?? undefined,
      providerLimitResetAt: row.providerLimitResetAt?.getTime(),
      rampEnabled: row.rampEnabled,
      rampStatus: row.rampStatus,
      rampCurrentLimit: row.rampCurrentLimit ?? undefined,
      rampTargetLimit: row.rampTargetLimit,
      rampNextCheckAt: row.rampNextCheckAt?.getTime(),
      rampReason: row.rampReason ?? undefined,
      effectiveDailyLimit: Math.min(
        row.dailySendLimit,
        row.rampEnabled ? (row.rampCurrentLimit ?? row.dailySendLimit) : row.dailySendLimit
      ),
      availableToday: Math.max(
        0,
        Math.min(
          row.dailySendLimit,
          row.rampEnabled ? (row.rampCurrentLimit ?? row.dailySendLimit) : row.dailySendLimit
        ) -
          row.emailsSentToday -
          row.reservedSends
      ),
    }));
  }

  async listActive(): Promise<MailboxRecord[]> {
    const rows = await this.db
      .select()
      .from(mailboxes)
      .where(and(eq(mailboxes.status, "active"), isNull(mailboxes.archivedAt)));
    return rows.map(toMailbox);
  }

  async listRampDue(now: number, limit = 100): Promise<MailboxRecord[]> {
    const rows = await this.db
      .select()
      .from(mailboxes)
      .where(
        and(
          eq(mailboxes.rampEnabled, true),
          isNull(mailboxes.archivedAt),
          or(isNull(mailboxes.rampNextCheckAt), lte(mailboxes.rampNextCheckAt, new Date(now)))
        )
      )
      .limit(Math.min(Math.max(limit, 1), 500));
    return rows.map(toMailbox);
  }

  async updateRamp(
    id: MailboxId,
    orgId: OrgId,
    decision: RampDecision,
    expectedNextCheckAt?: number
  ): Promise<boolean> {
    const rows = await this.db
      .update(mailboxes)
      .set({
        rampStatus: decision.status,
        rampCurrentLimit: decision.currentLimit,
        rampReason: decision.reason,
        rampHoldUntil: decision.holdUntil ? new Date(decision.holdUntil) : null,
        rampNextCheckAt: new Date(decision.nextCheckAt),
        rampUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mailboxes.id, id),
          eq(mailboxes.orgId, orgId),
          expectedNextCheckAt === undefined
            ? isNull(mailboxes.rampNextCheckAt)
            : eq(mailboxes.rampNextCheckAt, new Date(expectedNextCheckAt))
        )
      )
      .returning();
    return rows.length === 1;
  }

  async configureRamp(
    id: MailboxId,
    orgId: OrgId,
    input: {
      action: "enable" | "disable" | "pause" | "resume" | "reset" | "update";
      targetLimit: number;
      now: number;
    }
  ): Promise<void> {
    const current = await this.getRawById(id, orgId);
    if (!current) return;
    const target = Math.min(Math.max(Math.trunc(input.targetLimit), 5), 100);
    const enabled = input.action !== "disable";
    const reset = input.action === "reset" || !current.rampStartedAt;
    const status =
      input.action === "disable"
        ? "disabled"
        : input.action === "pause"
          ? "paused"
          : input.action === "resume"
            ? "recovering"
            : input.action === "update"
              ? current.rampStatus
              : reset
                ? "pending"
                : current.rampStatus;
    await this.db
      .update(mailboxes)
      .set({
        rampEnabled: enabled,
        rampStatus: status,
        rampStartedAt: enabled ? (reset ? new Date(input.now) : current.rampStartedAt) : null,
        rampUpdatedAt: new Date(input.now),
        rampCurrentLimit: enabled ? (reset ? 5 : current.rampCurrentLimit) : null,
        rampTargetLimit: target,
        rampNextCheckAt: enabled ? new Date(input.now) : null,
        rampHoldUntil: null,
        rampReason:
          input.action === "pause"
            ? "operator-paused"
            : input.action === "resume"
              ? "recovering"
              : input.action === "update"
                ? current.rampReason
                : enabled
                  ? "pending"
                  : "disabled",
        updatedAt: new Date(input.now),
      })
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId)));
  }

  async listActiveByIds(ids: MailboxId[], orgId: OrgId): Promise<MailboxRecord[]> {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return [];

    const rows = await this.db
      .select()
      .from(mailboxes)
      .where(
        and(
          eq(mailboxes.orgId, orgId),
          eq(mailboxes.status, "active"),
          isNull(mailboxes.archivedAt),
          inArray(mailboxes.id, uniqueIds)
        )
      );
    return rows.map(toMailbox);
  }

  async incrementSentToday(
    id: MailboxId,
    orgId: OrgId,
    reservation?: { assignmentId: AssignmentId; stepNumber: number }
  ): Promise<void> {
    const current = await this.getRawById(id, orgId);
    if (!current) return;
    const released = reservation ? await this.deleteReservation(id, orgId, reservation) : 0;

    await this.db
      .update(mailboxes)
      .set({
        emailsSentToday: sql`${mailboxes.emailsSentToday} + 1`,
        reservedSends: sql`greatest(${mailboxes.reservedSends} - ${released}, 0)`,
        lastSuccessfulSendAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId)));
  }

  async releaseReservation(
    id: MailboxId,
    orgId: OrgId,
    reservation?: { assignmentId: AssignmentId; stepNumber: number }
  ): Promise<void> {
    const released = reservation ? await this.deleteReservation(id, orgId, reservation) : 1;
    if (released === 0) return;
    await this.db
      .update(mailboxes)
      .set({
        reservedSends: sql`greatest(${mailboxes.reservedSends} - ${released}, 0)`,
        updatedAt: new Date(),
      })
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId)));
  }

  private async deleteReservation(
    id: MailboxId,
    orgId: OrgId,
    reservation: { assignmentId: AssignmentId; stepNumber: number }
  ) {
    const rows = await this.db
      .delete(sendReservations)
      .where(
        and(
          eq(sendReservations.orgId, orgId),
          eq(sendReservations.mailboxId, id),
          eq(sendReservations.assignmentId, reservation.assignmentId),
          eq(sendReservations.stepNumber, reservation.stepNumber)
        )
      )
      .returning();
    return rows.length;
  }

  async updateLastPolledAt(id: MailboxId, orgId: OrgId, at: number): Promise<void> {
    await this.db
      .update(mailboxes)
      .set({ lastPolledAt: new Date(at), updatedAt: new Date() })
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId)));
  }

  async updateStatus(id: MailboxId, orgId: OrgId, status: MailboxStatus): Promise<void> {
    await this.db
      .update(mailboxes)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId)));
  }

  async reconnect(id: MailboxId, orgId: OrgId, input: ReconnectMailboxInput): Promise<void> {
    await this.db
      .update(mailboxes)
      .set({
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
        status: "active",
        lastConnectionError: input.clearHealth ? null : undefined,
        lastTokenRefreshError: input.clearHealth ? null : undefined,
        providerLimitCode: input.clearHealth ? null : undefined,
        providerLimitResetAt: input.clearHealth ? null : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId)));
  }

  async recordConnectionSuccess(id: MailboxId, orgId: OrgId, at: number): Promise<void> {
    await this.db
      .update(mailboxes)
      .set({
        status: "active",
        lastConnectionTestAt: new Date(at),
        lastConnectionError: null,
        updatedAt: new Date(),
      })
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId)));
  }

  async recordConnectionFailure(
    id: MailboxId,
    orgId: OrgId,
    failure: MailboxFailure,
    at: number
  ): Promise<void> {
    await this.db
      .update(mailboxes)
      .set({
        status: failure.status,
        lastConnectionTestAt: new Date(at),
        lastConnectionError: failure.message,
        providerLimitCode: failure.providerLimitCode,
        updatedAt: new Date(),
      })
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId)));
  }

  async recordTokenRefreshSuccess(id: MailboxId, orgId: OrgId, at: number): Promise<void> {
    await this.db
      .update(mailboxes)
      .set({
        lastTokenRefreshAt: new Date(at),
        lastTokenRefreshError: null,
        status: "active",
        updatedAt: new Date(),
      })
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId)));
  }

  async recordTokenRefreshFailure(
    id: MailboxId,
    orgId: OrgId,
    message: string,
    at: number
  ): Promise<void> {
    await this.db
      .update(mailboxes)
      .set({
        status: "disconnected",
        lastTokenRefreshAt: new Date(at),
        lastTokenRefreshError: message,
        updatedAt: new Date(),
      })
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId)));
  }

  async countActiveCampaignLinks(id: MailboxId, orgId: OrgId): Promise<number> {
    const rows = await this.db
      .select({ id: campaignMailboxes.id })
      .from(campaignMailboxes)
      .where(
        and(
          eq(campaignMailboxes.mailboxId, id),
          eq(campaignMailboxes.orgId, orgId),
          eq(campaignMailboxes.status, "enabled")
        )
      );
    return rows.length;
  }

  async disableCampaignLinks(id: MailboxId, orgId: OrgId): Promise<number> {
    const rows = await this.db
      .update(campaignMailboxes)
      .set({ status: "disabled" })
      .where(
        and(
          eq(campaignMailboxes.mailboxId, id),
          eq(campaignMailboxes.orgId, orgId),
          eq(campaignMailboxes.status, "enabled")
        )
      )
      .returning();
    return rows.length;
  }

  async archive(id: MailboxId, orgId: OrgId, at: number): Promise<void> {
    await this.db
      .update(mailboxes)
      .set({
        status: "disconnected",
        encryptedPassword: null,
        encryptedRefreshToken: null,
        encryptedAccessToken: null,
        tokenExpiresAt: null,
        archivedAt: new Date(at),
        updatedAt: new Date(),
      })
      .where(and(eq(mailboxes.id, id), eq(mailboxes.orgId, orgId)));
  }

  async resetDailyCounters(): Promise<number> {
    const rows = await this.db
      .update(mailboxes)
      .set({ emailsSentToday: 0, reservedSends: 0, updatedAt: new Date() })
      .returning();
    return rows.length;
  }
}

function toMailbox(row: typeof mailboxes.$inferSelect): MailboxRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    email: row.userEmail ?? row.username ?? "",
    provider: row.provider,
    status: row.status,
    sentToday: row.emailsSentToday,
    reservedSends: row.reservedSends,
    dailySendLimit: row.dailySendLimit,
    lastPolledAt: row.lastPolledAt?.getTime(),
    lastConnectionTestAt: row.lastConnectionTestAt?.getTime(),
    lastConnectionError: row.lastConnectionError ?? undefined,
    lastTokenRefreshAt: row.lastTokenRefreshAt?.getTime(),
    lastTokenRefreshError: row.lastTokenRefreshError ?? undefined,
    providerLimitCode: row.providerLimitCode ?? undefined,
    providerLimitResetAt: row.providerLimitResetAt?.getTime(),
    rampEnabled: row.rampEnabled,
    rampStatus: row.rampStatus,
    rampCurrentLimit: row.rampCurrentLimit ?? undefined,
    rampTargetLimit: row.rampTargetLimit,
    rampStartedAt: row.rampStartedAt?.getTime(),
    rampIncrement: row.rampIncrement,
    rampNextCheckAt: row.rampNextCheckAt?.getTime(),
    rampHoldUntil: row.rampHoldUntil?.getTime(),
    rampReason: row.rampReason ?? undefined,
    archivedAt: row.archivedAt?.getTime(),
  };
}
