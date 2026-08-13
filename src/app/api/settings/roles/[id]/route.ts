import { z } from "zod";

import { createSessionAction } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { getAuthProvider } from "@/server/auth/provider";
import { createRequestRoleModule, permissionRequestFor } from "@/server/modules/roles";

const updateSchema = z
  .object({
    name: z.string().optional(),
    permissions: z.array(z.string()).optional(),
  })
  .strict();

export const PATCH = createSessionAction(
  sessionOperations.roleUpdate,
  async (
    { orgId, userId, tenant },
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) => {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid role" }, { status: 400 });
    const permissions = parsed.data.permissions ?? [];
    const allowed = await getAuthProvider().hasPermission(permissionRequestFor(permissions));
    const roles = await createRequestRoleModule({
      orgId,
      userId,
      tenant,
      headers: request.headers,
    });
    const { id } = await context.params;
    try {
      return Response.json(
        await roles.update({
          orgId,
          id,
          ...parsed.data,
          grantablePermissions: allowed ? permissions : [],
        })
      );
    } catch (error) {
      return roleError(error);
    }
  }
);

export const DELETE = createSessionAction(
  sessionOperations.roleDelete,
  async (
    { orgId, userId, tenant },
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) => {
    const roles = await createRequestRoleModule({
      orgId,
      userId,
      tenant,
      headers: request.headers,
    });
    const { id } = await context.params;
    try {
      await roles.remove({ orgId, id });
      return Response.json({ deleted: true });
    } catch (error) {
      return roleError(error);
    }
  }
);

function roleError(error: unknown) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Role operation failed" },
    { status: 400 }
  );
}
