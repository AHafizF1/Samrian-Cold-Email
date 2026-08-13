import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";

import type { DbClient, DbTransaction } from "./tx";

export type TenantContext = {
  orgId: string;
  userId?: string;
  actorType: "request" | "worker" | "system";
};

type TenantScope = { context: TenantContext; db: DbTransaction };

const tenantScope = new AsyncLocalStorage<TenantScope>();

export function getTenantDb() {
  return tenantScope.getStore()?.db;
}

export async function withTenant<T>(
  db: Pick<DbClient, "transaction">,
  context: TenantContext,
  operation: (db: DbTransaction) => Promise<T>
): Promise<T> {
  assertContext(context);
  const active = tenantScope.getStore();
  if (active) {
    if (!sameContext(active.context, context)) {
      throw new Error("Cannot switch tenant inside active transaction");
    }
    return operation(active.db);
  }

  return db.transaction(async (tx) => {
    await assertRuntimeRole(tx, context.actorType);
    await tx.execute(sql`select set_config('app.org_id', ${context.orgId}, true)`);
    await tx.execute(sql`select set_config('app.user_id', ${context.userId ?? ""}, true)`);
    await tx.execute(sql`select set_config('app.actor_type', ${context.actorType}, true)`);
    return tenantScope.run({ context, db: tx }, () => operation(tx));
  });
}

async function assertRuntimeRole(db: DbTransaction, actorType: TenantContext["actorType"]) {
  await assertDatabaseRole(db, actorType === "request" ? "app" : "worker");
}

export async function assertDatabaseRole(
  db: Pick<DbTransaction, "execute">,
  purpose: "app" | "auth" | "worker"
) {
  const role = `samrian_${purpose}`;
  await db.execute(sql`
    select 1 / ((
      not coalesce((select rolsuper or rolbypassrls from pg_roles where rolname = current_user), true)
      and pg_has_role(current_user, ${role}::name, 'member')
    )::int)
  `);
}

export async function withTrackingToken<T>(
  db: Pick<DbClient, "transaction">,
  token: string,
  operation: (db: DbTransaction) => Promise<T>
): Promise<T> {
  if (!token.trim()) throw new Error("Invalid tracking token");

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tracking_token', ${token}, true)`);
    return operation(tx);
  });
}

function assertContext(context: TenantContext) {
  if (
    !context.orgId.trim() ||
    (context.userId !== undefined && !context.userId.trim()) ||
    !["request", "worker", "system"].includes(context.actorType)
  ) {
    throw new Error("Invalid tenant context");
  }
}

function sameContext(left: TenantContext, right: TenantContext) {
  return (
    left.orgId === right.orgId && left.userId === right.userId && left.actorType === right.actorType
  );
}
