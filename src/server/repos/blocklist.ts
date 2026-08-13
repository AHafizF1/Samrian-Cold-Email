import { and, eq } from "drizzle-orm";

import { blocklist } from "../db/schema";
import type { BlocklistRecord, OrgId } from "../ports";
import type { DbExecutor } from "../db/tx";
import { newId } from "./ids";

export type BlocklistReason = "unsubscribed" | "bounced_hard" | "manual";

export type BlocklistEntry = BlocklistRecord & {
  _id: string;
  _creationTime: number;
  createdAt: number;
  campaignId?: string;
  unsubscribeToken?: string;
};

export class PostgresBlocklistRepo {
  constructor(private readonly db: DbExecutor) {}

  async add(input: BlocklistRecord): Promise<void> {
    const existing = await this.find(input.email, input.orgId);
    if (existing) return;

    await this.db.insert(blocklist).values({
      id: newId("block"),
      orgId: input.orgId,
      email: input.email.toLowerCase(),
      reason: toReason(input.reason),
    });
  }

  async remove(email: string, orgId: OrgId): Promise<boolean> {
    const rows = await this.db
      .delete(blocklist)
      .where(and(eq(blocklist.email, email.toLowerCase()), eq(blocklist.orgId, orgId)))
      .returning();
    return rows.length > 0;
  }

  async removeById(id: string, orgId: OrgId): Promise<boolean> {
    const rows = await this.db
      .delete(blocklist)
      .where(and(eq(blocklist.id, id), eq(blocklist.orgId, orgId)))
      .returning();
    return rows.length > 0;
  }

  async list(orgId: OrgId, limit = 100): Promise<BlocklistRecord[]> {
    const rows = await this.db
      .select()
      .from(blocklist)
      .where(eq(blocklist.orgId, orgId))
      .limit(limit);
    return rows.map((row) => ({
      orgId: row.orgId,
      email: row.email,
      reason: row.reason,
    }));
  }

  async listEntries(orgId: OrgId, limit = 100): Promise<BlocklistEntry[]> {
    const rows = await this.db
      .select()
      .from(blocklist)
      .where(eq(blocklist.orgId, orgId))
      .limit(limit);
    return rows.map((row) => ({
      _id: row.id,
      _creationTime: row.createdAt.getTime(),
      orgId: row.orgId,
      email: row.email,
      reason: row.reason,
      campaignId: row.campaignId ?? undefined,
      unsubscribeToken: row.unsubscribeToken ?? undefined,
      createdAt: row.createdAt.getTime(),
    }));
  }

  async isBlocked(email: string, orgId: OrgId): Promise<boolean> {
    return !!(await this.find(email, orgId));
  }

  private async find(email: string, orgId: OrgId) {
    const [row] = await this.db
      .select({ id: blocklist.id })
      .from(blocklist)
      .where(and(eq(blocklist.email, email.toLowerCase()), eq(blocklist.orgId, orgId)))
      .limit(1);
    return row ?? null;
  }
}

function toReason(reason: string | undefined): BlocklistReason {
  if (reason === "unsubscribed" || reason === "bounced_hard" || reason === "manual") return reason;
  return "manual";
}
