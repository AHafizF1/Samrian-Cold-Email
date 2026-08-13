import { and, desc, eq, gte, lt, lte, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import {
  campaignStatsDaily,
  emailEvents,
  mailboxStatsDaily,
  orgStatsDaily,
  trackedLinks,
} from "../db/schema";
import type { DbExecutor } from "../db/tx";
import type { EmailEventInput, EventRecordResult, OrgId } from "../ports";
import { newId } from "./ids";

export type StatsCounts = {
  sent: number;
  failed: number;
  replies: number;
  unsubscribes: number;
  hardBounces: number;
  softBounces: number;
  totalClicks: number;
  uniqueClicks: number;
  totalOpens: number;
  uniqueOpens: number;
};

export type DateRange = {
  from?: Date;
  to?: Date;
};

export class PostgresEventRepo {
  constructor(private readonly db: DbExecutor) {}

  async record(input: EmailEventInput): Promise<EventRecordResult> {
    return this.db.transaction(async (tx) => {
      const occurredAt = new Date(input.occurredAt);
      const inserted = await tx
        .insert(emailEvents)
        .values({
          id: newId("event"),
          orgId: input.orgId,
          campaignId: input.campaignId,
          contactId: input.contactId,
          mailboxId: input.mailboxId,
          assignmentId: input.assignmentId,
          threadId: input.threadId,
          messageId: input.messageId,
          type: input.type,
          stepNumber: input.stepNumber,
          dedupeKey: input.dedupeKey,
          metadata: input.metadata,
          occurredAt,
        })
        .onConflictDoNothing({ target: [emailEvents.orgId, emailEvents.dedupeKey] })
        .returning();

      if (inserted.length === 0) return { accepted: false };

      const delta = getDelta(input);
      const day = toDay(occurredAt);
      await this.incrementOrg(tx, input.orgId, day, delta);
      if (input.campaignId) await this.incrementCampaign(tx, input, day, delta);
      if (input.mailboxId) await this.incrementMailbox(tx, input, day, delta);
      return { accepted: true };
    });
  }

  async createTrackedLink(input: {
    orgId: string;
    originalUrl: string;
    token: string;
    campaignId?: string;
    contactId?: string;
    assignmentId?: string;
    threadId?: string;
    messageId?: string;
  }) {
    const [row] = await this.db
      .insert(trackedLinks)
      .values({ id: newId("link"), ...input })
      .returning();
    return row;
  }

  async getTrackedLink(token: string) {
    const [row] = await this.db.select().from(trackedLinks).where(eq(trackedLinks.token, token));
    return row ?? null;
  }

  async listEvents(input: { orgId: OrgId; range?: DateRange; limit: number }) {
    return this.db
      .select()
      .from(emailEvents)
      .where(and(eq(emailEvents.orgId, input.orgId), ...eventRangeFilters(input.range)))
      .limit(input.limit);
  }

  async listEventPage(input: {
    orgId: OrgId;
    range?: DateRange;
    limit: number;
    cursor?: { occurredAt: Date; id: string };
  }) {
    return this.db
      .select()
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.orgId, input.orgId),
          ...eventRangeFilters(input.range),
          input.cursor
            ? or(
                lt(emailEvents.occurredAt, input.cursor.occurredAt),
                and(
                  eq(emailEvents.occurredAt, input.cursor.occurredAt),
                  lt(emailEvents.id, input.cursor.id)
                )
              )
            : undefined
        )
      )
      .orderBy(desc(emailEvents.occurredAt), desc(emailEvents.id))
      .limit(input.limit);
  }

  async getMailboxRampEvidence(mailboxId: string, orgId: OrgId, since: number) {
    const [row] = await this.db
      .select({
        sent: sql<number>`count(*) filter (where ${emailEvents.type} = 'sent')`,
        failed: sql<number>`count(*) filter (where ${emailEvents.type} = 'failed')`,
        hardBounces: sql<number>`count(*) filter (where ${emailEvents.type} = 'bounce_hard')`,
        softBounces: sql<number>`count(*) filter (where ${emailEvents.type} = 'bounce_soft')`,
        unsubscribes: sql<number>`count(*) filter (where ${emailEvents.type} = 'unsubscribe')`,
      })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.orgId, orgId),
          eq(emailEvents.mailboxId, mailboxId),
          gte(emailEvents.occurredAt, new Date(since))
        )
      );
    return {
      sent: Number(row?.sent ?? 0),
      failed: Number(row?.failed ?? 0),
      hardBounces: Number(row?.hardBounces ?? 0),
      softBounces: Number(row?.softBounces ?? 0),
      unsubscribes: Number(row?.unsubscribes ?? 0),
    };
  }

  private async incrementOrg(db: DbExecutor, orgId: string, day: string, delta: StatsCounts) {
    await db
      .insert(orgStatsDaily)
      .values({ id: newId("org_stats"), orgId, day, ...delta, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [orgStatsDaily.orgId, orgStatsDaily.day],
        set: incrementSet(orgStatsDaily, delta),
      });
  }

  private async incrementCampaign(
    db: DbExecutor,
    input: EmailEventInput,
    day: string,
    delta: StatsCounts
  ) {
    await db
      .insert(campaignStatsDaily)
      .values({
        id: newId("campaign_stats"),
        orgId: input.orgId,
        campaignId: input.campaignId!,
        day,
        ...delta,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [campaignStatsDaily.orgId, campaignStatsDaily.campaignId, campaignStatsDaily.day],
        set: incrementSet(campaignStatsDaily, delta),
      });
  }

  private async incrementMailbox(
    db: DbExecutor,
    input: EmailEventInput,
    day: string,
    delta: StatsCounts
  ) {
    await db
      .insert(mailboxStatsDaily)
      .values({
        id: newId("mailbox_stats"),
        orgId: input.orgId,
        mailboxId: input.mailboxId!,
        day,
        ...delta,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [mailboxStatsDaily.orgId, mailboxStatsDaily.mailboxId, mailboxStatsDaily.day],
        set: incrementSet(mailboxStatsDaily, delta),
      });
  }
}

export class PostgresStatsRepo {
  constructor(private readonly db: DbExecutor) {}

  async getOrgStats(orgId: OrgId, range: DateRange = {}): Promise<StatsCounts> {
    const [row] = await this.db
      .select(sumColumns(orgStatsDaily))
      .from(orgStatsDaily)
      .where(and(eq(orgStatsDaily.orgId, orgId), ...dayRangeFilters(orgStatsDaily.day, range)));
    return countsFromRow(row);
  }

  async getCampaignStats(input: { orgId: OrgId; campaignId: string; range?: DateRange }) {
    const [row] = await this.db
      .select(sumColumns(campaignStatsDaily))
      .from(campaignStatsDaily)
      .where(
        and(
          eq(campaignStatsDaily.orgId, input.orgId),
          eq(campaignStatsDaily.campaignId, input.campaignId),
          ...dayRangeFilters(campaignStatsDaily.day, input.range)
        )
      );
    return countsFromRow(row);
  }
}

function getDelta(input: EmailEventInput): StatsCounts {
  const empty = emptyCounts();
  if (input.type === "sent") return { ...empty, sent: 1 };
  if (input.type === "failed") return { ...empty, failed: 1 };
  if (input.type === "reply") return { ...empty, replies: 1 };
  if (input.type === "unsubscribe") return { ...empty, unsubscribes: 1 };
  if (input.type === "bounce_hard") return { ...empty, hardBounces: 1 };
  if (input.type === "bounce_soft") return { ...empty, softBounces: 1 };
  if (input.type === "click") {
    return { ...empty, totalClicks: 1, uniqueClicks: input.metadata?.unique === false ? 0 : 1 };
  }
  if (input.type === "open") {
    return { ...empty, totalOpens: 1, uniqueOpens: input.metadata?.unique === false ? 0 : 1 };
  }
  return empty;
}

function emptyCounts(): StatsCounts {
  return {
    sent: 0,
    failed: 0,
    replies: 0,
    unsubscribes: 0,
    hardBounces: 0,
    softBounces: 0,
    totalClicks: 0,
    uniqueClicks: 0,
    totalOpens: 0,
    uniqueOpens: 0,
  };
}

function incrementSet(
  table: typeof orgStatsDaily | typeof campaignStatsDaily | typeof mailboxStatsDaily,
  delta: StatsCounts
) {
  return {
    sent: sql`${table.sent} + ${delta.sent}`,
    failed: sql`${table.failed} + ${delta.failed}`,
    replies: sql`${table.replies} + ${delta.replies}`,
    unsubscribes: sql`${table.unsubscribes} + ${delta.unsubscribes}`,
    hardBounces: sql`${table.hardBounces} + ${delta.hardBounces}`,
    softBounces: sql`${table.softBounces} + ${delta.softBounces}`,
    totalClicks: sql`${table.totalClicks} + ${delta.totalClicks}`,
    uniqueClicks: sql`${table.uniqueClicks} + ${delta.uniqueClicks}`,
    totalOpens: sql`${table.totalOpens} + ${delta.totalOpens}`,
    uniqueOpens: sql`${table.uniqueOpens} + ${delta.uniqueOpens}`,
    updatedAt: new Date(),
  };
}

function sumColumns(
  table: typeof orgStatsDaily | typeof campaignStatsDaily | typeof mailboxStatsDaily
) {
  return {
    sent: sql<number>`coalesce(sum(${table.sent}), 0)`,
    failed: sql<number>`coalesce(sum(${table.failed}), 0)`,
    replies: sql<number>`coalesce(sum(${table.replies}), 0)`,
    unsubscribes: sql<number>`coalesce(sum(${table.unsubscribes}), 0)`,
    hardBounces: sql<number>`coalesce(sum(${table.hardBounces}), 0)`,
    softBounces: sql<number>`coalesce(sum(${table.softBounces}), 0)`,
    totalClicks: sql<number>`coalesce(sum(${table.totalClicks}), 0)`,
    uniqueClicks: sql<number>`coalesce(sum(${table.uniqueClicks}), 0)`,
    totalOpens: sql<number>`coalesce(sum(${table.totalOpens}), 0)`,
    uniqueOpens: sql<number>`coalesce(sum(${table.uniqueOpens}), 0)`,
  };
}

function countsFromRow(row?: Record<keyof StatsCounts, unknown>): StatsCounts {
  const empty = emptyCounts();
  if (!row) return empty;
  return Object.fromEntries(
    Object.keys(empty).map((key) => [key, Number(row[key as keyof StatsCounts] ?? 0)])
  ) as StatsCounts;
}

function toDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayRangeFilters(dayColumn: AnyPgColumn, range: DateRange = {}) {
  const filters = [];
  if (range.from) filters.push(gte(dayColumn, toDay(range.from)));
  if (range.to) filters.push(lte(dayColumn, toDay(range.to)));
  return filters;
}

function eventRangeFilters(range: DateRange = {}) {
  const filters = [];
  if (range.from) filters.push(gte(emailEvents.occurredAt, range.from));
  if (range.to) filters.push(lte(emailEvents.occurredAt, range.to));
  return filters;
}
