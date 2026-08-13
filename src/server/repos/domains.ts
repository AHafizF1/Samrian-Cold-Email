import { and, eq } from "drizzle-orm";

import { senderDomains } from "../db/schema";
import type { DbExecutor, DbTransaction } from "../db/tx";
import type { DomainDeps } from "../modules/domains";
import type { DomainCheckResult } from "../deliverability/dns";
import type { OrgId } from "../ports";
import { newId } from "./ids";

export class PostgresDomainRepo {
  constructor(private readonly db: DbExecutor) {}

  async get(orgId: OrgId, domain: string): Promise<DomainCheckResult | null> {
    const [row] = await this.db
      .select()
      .from(senderDomains)
      .where(and(eq(senderDomains.orgId, orgId), eq(senderDomains.domain, domain)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async upsert(input: DomainCheckResult & { orgId: OrgId }): Promise<void> {
    const current = await this.get(input.orgId, input.domain);
    const values = {
      source: input.source,
      status: input.status,
      checks: input.checks,
      issues: input.issues,
      warnings: input.warnings,
      checkedAt: new Date(input.checkedAt),
      updatedAt: new Date(),
    };

    if (current) {
      await this.db
        .update(senderDomains)
        .set(values)
        .where(and(eq(senderDomains.orgId, input.orgId), eq(senderDomains.domain, input.domain)));
      return;
    }

    await this.db.insert(senderDomains).values({
      id: newId("sender_domain"),
      orgId: input.orgId,
      domain: input.domain,
      ...values,
    });
  }
}

export function createDomainPort(
  tenant: <T>(operation: (db: DbTransaction) => Promise<T>) => Promise<T>
): DomainDeps["domains"] {
  return {
    get: (orgId, domain) => tenant((db) => new PostgresDomainRepo(db).get(orgId, domain)),
    upsert: (input) => tenant((db) => new PostgresDomainRepo(db).upsert(input)),
  };
}

function toDomain(row: typeof senderDomains.$inferSelect): DomainCheckResult {
  return {
    domain: row.domain,
    source: "dns",
    status: row.status as DomainCheckResult["status"],
    checks: row.checks as DomainCheckResult["checks"],
    issues: Array.isArray(row.issues) ? row.issues.map(String) : [],
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    checkedAt: row.checkedAt.getTime(),
  };
}
