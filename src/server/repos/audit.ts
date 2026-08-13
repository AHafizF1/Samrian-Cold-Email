import { and, eq } from "drizzle-orm";

import { auditLogs } from "../db/schema";
import type { AuditId, AuditRecord, OrgId, UserId } from "../ports";
import type { DbExecutor } from "../db/tx";
import { newId } from "./ids";

export type CreateAuditInput = {
  orgId: OrgId;
  userId: UserId;
  action: string;
  details: string;
};

export class PostgresAuditRepo {
  constructor(private readonly db: DbExecutor) {}

  async create(input: CreateAuditInput): Promise<AuditRecord> {
    const [row] = await this.db
      .insert(auditLogs)
      .values({ id: newId("audit"), ...input })
      .returning();
    return toAudit(row);
  }

  async getById(id: AuditId, orgId: OrgId): Promise<AuditRecord | null> {
    const [row] = await this.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.id, id), eq(auditLogs.orgId, orgId)))
      .limit(1);
    return row ? toAudit(row) : null;
  }
}

function toAudit(row: typeof auditLogs.$inferSelect): AuditRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    action: row.action,
    createdAt: row.createdAt.getTime(),
  };
}
