import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { PostgresGroupRepo } from "@/server/repos";
import { groupWriteSchema } from "@samrian/contracts";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "groups.get",
    credentials,
    handler: async ({ principal }) => {
      const { id } = await context.params;
      const group = await new PostgresGroupRepo(getDb()).getById(id, principal.orgId);
      if (!group) throw new ApiRouteError("NOT_FOUND", "Group not found", 404);
      const { orgId: _orgId, ...data } = group;
      return { data };
    },
  })(request);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "groups.update",
    credentials,
    handler: async ({ principal, request }) => {
      const parsed = groupWriteSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid group", 400);
      const { id } = await context.params;
      const group = await new PostgresGroupRepo(getDb()).update(id, principal.orgId, parsed.data);
      if (!group) throw new ApiRouteError("NOT_FOUND", "Group not found", 404);
      const { orgId: _orgId, ...data } = group;
      return { data };
    },
  })(request);
}
