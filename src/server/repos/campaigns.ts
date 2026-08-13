import { and, eq } from "drizzle-orm";

import { campaigns, contactAssignments } from "../db/schema";
import type { DbExecutor } from "../db/tx";
import type { CampaignId, CampaignRecord, CampaignStats, OrgId } from "../ports";
import { newId } from "./ids";

export type CreateCampaignInput = {
  id?: CampaignId;
  orgId: OrgId;
  name: string;
  schedule: unknown;
  steps: readonly unknown[];
  status?: "draft" | "active" | "paused" | "completed";
  targetGroupId?: string;
  targetContactIds?: string[];
  listUnsubscribeEnabled?: boolean | null;
};

export type CampaignListItem = CampaignRecord & {
  _id: CampaignId;
  _creationTime: number;
  schedule: Record<string, unknown>;
  targetGroupId?: string;
  targetContactIds?: string[];
  mailboxIds?: string[];
};

export type CampaignLaunchRecord = CampaignRecord & {
  schedule: Record<string, unknown>;
  targetGroupId?: string;
  targetContactIds?: string[];
};

export class PostgresCampaignRepo {
  constructor(private readonly db: DbExecutor) {}

  async create(input: CreateCampaignInput): Promise<CampaignRecord> {
    const [row] = await this.db
      .insert(campaigns)
      .values({
        id: input.id ?? newId("campaign"),
        orgId: input.orgId,
        name: input.name,
        schedule: input.schedule,
        steps: [...input.steps],
        status: input.status ?? "draft",
        targetGroupId: input.targetGroupId,
        targetContactIds: input.targetContactIds,
        listUnsubscribeEnabled: input.listUnsubscribeEnabled,
      })
      .returning();
    return toCampaign(row);
  }

  async saveDraft(input: CreateCampaignInput): Promise<CampaignId> {
    if (!input.id) {
      const created = await this.create({ ...input, status: "draft" });
      return created.id;
    }

    await this.db
      .update(campaigns)
      .set({
        name: input.name,
        schedule: input.schedule,
        steps: [...input.steps],
        targetGroupId: input.targetGroupId,
        targetContactIds: input.targetContactIds,
        listUnsubscribeEnabled: input.listUnsubscribeEnabled,
        status: "draft",
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, input.id), eq(campaigns.orgId, input.orgId)));

    return input.id;
  }

  async getById(id: CampaignId, orgId: OrgId): Promise<CampaignRecord | null> {
    const [row] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)))
      .limit(1);
    return row ? toCampaign(row) : null;
  }

  async getLaunch(id: CampaignId, orgId: OrgId): Promise<CampaignLaunchRecord | null> {
    const [row] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)))
      .limit(1);
    return row ? toCampaignLaunch(row) : null;
  }

  async list(orgId: OrgId): Promise<CampaignRecord[]> {
    const rows = await this.db.select().from(campaigns).where(eq(campaigns.orgId, orgId));
    return rows.map(toCampaign);
  }

  async listItems(orgId: OrgId, limit = 50): Promise<CampaignListItem[]> {
    const rows = await this.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.orgId, orgId))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map(toCampaignItem);
  }

  async updateStatus(id: CampaignId, orgId: OrgId, status: string): Promise<void> {
    await this.db
      .update(campaigns)
      .set({ status: toCampaignStatus(status), updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)));
  }

  async activateDraft(id: CampaignId, orgId: OrgId): Promise<boolean> {
    const rows = await this.db
      .update(campaigns)
      .set({ status: "active", updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId), eq(campaigns.status, "draft")))
      .returning();
    return rows.length > 0;
  }

  async getStats(id: CampaignId): Promise<CampaignStats | null> {
    const rows = await this.db
      .select()
      .from(contactAssignments)
      .where(eq(contactAssignments.campaignId, id));

    if (rows.length === 0) return { campaignId: id, total: 0, bounced: 0 };

    return {
      campaignId: id,
      total: rows.length,
      bounced: rows.filter((row) => row.status === "bounced").length,
      unsubscribed: rows.filter((row) => row.status === "unsubscribed").length,
    };
  }
}

function toCampaign(row: typeof campaigns.$inferSelect): CampaignRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    status: row.status,
    listUnsubscribeEnabled: row.listUnsubscribeEnabled,
    steps: Array.isArray(row.steps) ? row.steps : [],
  };
}

function toCampaignItem(row: typeof campaigns.$inferSelect): CampaignListItem {
  return {
    ...toCampaign(row),
    _id: row.id,
    _creationTime: row.createdAt.getTime(),
    schedule: asRecord(row.schedule),
    targetGroupId: row.targetGroupId ?? undefined,
    targetContactIds: Array.isArray(row.targetContactIds)
      ? row.targetContactIds.map(String)
      : undefined,
  };
}

function toCampaignLaunch(row: typeof campaigns.$inferSelect): CampaignLaunchRecord {
  return {
    ...toCampaign(row),
    schedule: asRecord(row.schedule),
    targetGroupId: row.targetGroupId ?? undefined,
    targetContactIds: Array.isArray(row.targetContactIds)
      ? row.targetContactIds.map(String)
      : undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toCampaignStatus(status: string): "draft" | "active" | "paused" | "completed" {
  if (status === "draft" || status === "active" || status === "paused" || status === "completed") {
    return status;
  }
  throw new Error(`Invalid campaign status: ${status}`);
}
