import { blocklistAddSchema, pageQuerySchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { PostgresBlocklistRepo, PostgresIdempotencyStore } from "@/server/repos";

export async function GET(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "blocklist.list",
    credentials,
    handler: async ({ principal }) => {
      const parsed = pageQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams)
      );
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid page", 400);
      const entries = await new PostgresBlocklistRepo(getDb()).listEntries(
        principal.orgId,
        parsed.data.limit
      );
      return {
        data: {
          items: entries.map(({ _id, email, reason, createdAt }) => ({
            id: _id,
            email,
            ...(reason ? { reason } : {}),
            createdAt,
          })),
        },
      };
    },
  })(request);
}

export async function POST(request: Request) {
  const credentials = await getMachineCredential();
  const db = getDb();
  return createApiRoute({
    operation: "blocklist.add",
    credentials,
    idempotency: ({ principal, operation }) =>
      new PostgresIdempotencyStore(db, {
        orgId: principal.orgId,
        credentialId: principal.credentialId,
        operationId: operation.id,
      }),
    handler: async ({ principal, request }) => {
      const parsed = blocklistAddSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success)
        throw new ApiRouteError("VALIDATION_FAILED", "Invalid blocklist entry", 400);
      await new PostgresBlocklistRepo(db).add({ ...parsed.data, orgId: principal.orgId });
      return { data: parsed.data };
    },
  })(request);
}
