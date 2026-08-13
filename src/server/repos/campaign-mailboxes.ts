import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";

import { campaignMailboxes, mailboxes, orgSettings, sendReservations } from "../db/schema";
import type { DbExecutor } from "../db/tx";
import type { AssignmentId, CampaignId, DispatchMailboxRecord, MailboxId, OrgId } from "../ports";
import { getProviderPolicy } from "../modules/providers";
import { newId } from "./ids";

export type ReplaceCampaignMailboxesInput = {
  campaignId: CampaignId;
  mailboxIds: MailboxId[];
  orgId: OrgId;
};

export class PostgresCampaignMailboxRepo {
  constructor(private readonly db: DbExecutor) {}

  async replaceForCampaign(input: ReplaceCampaignMailboxesInput): Promise<{ linked: number }> {
    const mailboxIds = Array.from(new Set(input.mailboxIds));
    if (mailboxIds.length === 0) {
      await this.db
        .delete(campaignMailboxes)
        .where(
          and(
            eq(campaignMailboxes.campaignId, input.campaignId),
            eq(campaignMailboxes.orgId, input.orgId)
          )
        );
      return { linked: 0 };
    }

    const active = await this.db
      .select({ id: mailboxes.id })
      .from(mailboxes)
      .where(
        and(
          eq(mailboxes.orgId, input.orgId),
          eq(mailboxes.status, "active"),
          isNull(mailboxes.archivedAt),
          inArray(mailboxes.id, mailboxIds)
        )
      );
    const activeIds = new Set(active.map((row) => row.id));
    if (activeIds.size !== mailboxIds.length) {
      throw new Error("Campaign launch requires every selected sender to be an active mailbox");
    }

    await this.db
      .delete(campaignMailboxes)
      .where(
        and(
          eq(campaignMailboxes.campaignId, input.campaignId),
          eq(campaignMailboxes.orgId, input.orgId)
        )
      );

    await this.db.insert(campaignMailboxes).values(
      mailboxIds.map((mailboxId) => ({
        id: newId("campaign_mailbox"),
        campaignId: input.campaignId,
        mailboxId,
        orgId: input.orgId,
        status: "enabled",
      }))
    );

    return { linked: mailboxIds.length };
  }

  async listForCampaign(campaignId: CampaignId, orgId: OrgId): Promise<MailboxId[]> {
    const rows = await this.db
      .select({ mailboxId: campaignMailboxes.mailboxId })
      .from(campaignMailboxes)
      .where(
        and(
          eq(campaignMailboxes.campaignId, campaignId),
          eq(campaignMailboxes.orgId, orgId),
          eq(campaignMailboxes.status, "enabled")
        )
      );
    return rows.map((row) => row.mailboxId);
  }

  async disable(campaignId: CampaignId, mailboxId: MailboxId, orgId: OrgId): Promise<boolean> {
    const rows = await this.db
      .update(campaignMailboxes)
      .set({ status: "disabled" })
      .where(
        and(
          eq(campaignMailboxes.campaignId, campaignId),
          eq(campaignMailboxes.mailboxId, mailboxId),
          eq(campaignMailboxes.orgId, orgId)
        )
      )
      .returning();
    return rows.length > 0;
  }

  async updateLastUsed(
    campaignId: CampaignId,
    mailboxId: MailboxId,
    orgId: OrgId,
    at: Date | number
  ) {
    await this.db
      .update(campaignMailboxes)
      .set({ lastUsedAt: typeof at === "number" ? new Date(at) : at })
      .where(
        and(
          eq(campaignMailboxes.campaignId, campaignId),
          eq(campaignMailboxes.mailboxId, mailboxId),
          eq(campaignMailboxes.orgId, orgId)
        )
      );
  }

  async listDispatchMailboxes(
    campaignId: CampaignId,
    orgId: OrgId
  ): Promise<DispatchMailboxRecord[]> {
    await this.releaseExpired(orgId, Date.now());
    const rows = await this.db
      .select({
        mailboxId: campaignMailboxes.mailboxId,
        emailsSentToday: mailboxes.emailsSentToday,
        reservedSends: mailboxes.reservedSends,
        dailySendLimit: mailboxes.dailySendLimit,
        provider: mailboxes.provider,
        lastUsedAt: campaignMailboxes.lastUsedAt,
        providerLimitResetAt: mailboxes.providerLimitResetAt,
        rampEnabled: mailboxes.rampEnabled,
        rampCurrentLimit: mailboxes.rampCurrentLimit,
        replyReserve: orgSettings.replyReserve,
      })
      .from(campaignMailboxes)
      .innerJoin(
        mailboxes,
        and(
          eq(mailboxes.id, campaignMailboxes.mailboxId),
          eq(mailboxes.orgId, campaignMailboxes.orgId)
        )
      )
      .leftJoin(orgSettings, eq(orgSettings.orgId, campaignMailboxes.orgId))
      .where(
        and(
          eq(campaignMailboxes.campaignId, campaignId),
          eq(campaignMailboxes.orgId, orgId),
          eq(campaignMailboxes.status, "enabled"),
          eq(mailboxes.status, "active"),
          isNull(mailboxes.archivedAt)
        )
      );

    return rows
      .map((row) => ({
        mailboxId: row.mailboxId,
        emailsSentToday: row.emailsSentToday,
        reservedSends: row.reservedSends,
        dailySendLimit: row.dailySendLimit,
        providerSafeLimit: getProviderPolicy(row.provider).maxSafeDailyLimit,
        replyReserve: row.replyReserve ?? 2,
        lastUsedAt: row.lastUsedAt?.getTime(),
        providerLimitResetAt: row.providerLimitResetAt?.getTime(),
        rampEnabled: row.rampEnabled,
        rampCurrentLimit: row.rampCurrentLimit ?? undefined,
      }))
      .sort((left, right) => {
        const bySent = left.emailsSentToday - right.emailsSentToday;
        if (bySent !== 0) return bySent;
        return (left.lastUsedAt ?? 0) - (right.lastUsedAt ?? 0);
      });
  }

  async reserveCapacity(input: {
    mailboxId: MailboxId;
    assignmentId: AssignmentId;
    stepNumber: number;
    orgId: OrgId;
    limit: number;
    now: number;
  }): Promise<boolean> {
    await this.releaseExpired(input.orgId, input.now);
    const [reservation] = await this.db
      .insert(sendReservations)
      .values({
        id: newId("reservation"),
        orgId: input.orgId,
        mailboxId: input.mailboxId,
        assignmentId: input.assignmentId,
        stepNumber: input.stepNumber,
        expiresAt: new Date(input.now + 30 * 60 * 1000),
      })
      .onConflictDoNothing()
      .returning();
    if (!reservation) {
      const [existing] = await this.db
        .select({ mailboxId: sendReservations.mailboxId })
        .from(sendReservations)
        .where(
          and(
            eq(sendReservations.orgId, input.orgId),
            eq(sendReservations.assignmentId, input.assignmentId),
            eq(sendReservations.stepNumber, input.stepNumber)
          )
        )
        .limit(1);
      return existing?.mailboxId === input.mailboxId;
    }

    const rows = await this.db
      .update(mailboxes)
      .set({
        reservedSends: sql`${mailboxes.reservedSends} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mailboxes.id, input.mailboxId),
          eq(mailboxes.orgId, input.orgId),
          eq(mailboxes.status, "active"),
          isNull(mailboxes.archivedAt),
          sql`${mailboxes.emailsSentToday} + ${mailboxes.reservedSends} < ${input.limit}`
        )
      )
      .returning();
    if (rows.length !== 1) {
      await this.db.delete(sendReservations).where(eq(sendReservations.id, reservation.id));
    }
    return rows.length === 1;
  }

  async releaseCapacity(input: {
    mailboxId: MailboxId;
    assignmentId: AssignmentId;
    stepNumber: number;
    orgId: OrgId;
  }): Promise<void> {
    const released = await this.db
      .delete(sendReservations)
      .where(
        and(
          eq(sendReservations.orgId, input.orgId),
          eq(sendReservations.mailboxId, input.mailboxId),
          eq(sendReservations.assignmentId, input.assignmentId),
          eq(sendReservations.stepNumber, input.stepNumber)
        )
      )
      .returning();
    if (released.length === 0) return;
    await this.db
      .update(mailboxes)
      .set({
        reservedSends: sql`greatest(${mailboxes.reservedSends} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(and(eq(mailboxes.id, input.mailboxId), eq(mailboxes.orgId, input.orgId)));
  }

  private async releaseExpired(orgId: OrgId, now: number) {
    const expired = await this.db
      .delete(sendReservations)
      .where(and(eq(sendReservations.orgId, orgId), lte(sendReservations.expiresAt, new Date(now))))
      .returning();
    const counts = new Map<string, number>();
    for (const row of expired) counts.set(row.mailboxId, (counts.get(row.mailboxId) ?? 0) + 1);
    for (const [mailboxId, count] of counts) {
      await this.db
        .update(mailboxes)
        .set({
          reservedSends: sql`greatest(${mailboxes.reservedSends} - ${count}, 0)`,
          updatedAt: new Date(),
        })
        .where(and(eq(mailboxes.id, mailboxId), eq(mailboxes.orgId, orgId)));
    }
  }
}
