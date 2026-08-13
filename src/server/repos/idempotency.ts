import { and, eq, gt } from "drizzle-orm";

import type { IdempotencyStore } from "../api/idempotency";
import { apiIdempotency } from "../db/schema";
import type { DbExecutor } from "../db/tx";
import { newId } from "./ids";
import { RETENTION } from "../data/retention";

export class PostgresIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly db: DbExecutor,
    private readonly context: { orgId: string; credentialId: string; operationId: string },
    private readonly now: () => Date = () => new Date()
  ) {}

  async get(key: string) {
    const [row] = await this.db
      .select()
      .from(apiIdempotency)
      .where(and(...this.filters(key), gt(apiIdempotency.expiresAt, this.now())))
      .limit(1);
    return row
      ? { fingerprint: row.fingerprint, ...(row.result === null ? {} : { result: row.result }) }
      : null;
  }

  async reserve(key: string, fingerprint: string) {
    const rows = await this.db
      .insert(apiIdempotency)
      .values({
        id: newId("idempotency"),
        ...this.context,
        key,
        fingerprint,
        expiresAt: new Date(this.now().getTime() + RETENTION.apiIdempotencyMs),
      })
      .onConflictDoNothing()
      .returning();
    return rows.length === 1;
  }

  async complete(key: string, result: unknown) {
    await this.db
      .update(apiIdempotency)
      .set({ state: "completed", result })
      .where(and(...this.filters(key)));
  }

  private filters(key: string) {
    return [
      eq(apiIdempotency.orgId, this.context.orgId),
      eq(apiIdempotency.credentialId, this.context.credentialId),
      eq(apiIdempotency.operationId, this.context.operationId),
      eq(apiIdempotency.key, key),
    ];
  }
}
