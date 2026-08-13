import { z } from "zod";

import { createSessionAction } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { getAuthProvider } from "@/server/auth/provider";
import {
  createRequestRoleModule,
  permissionOptions,
  permissionRequestFor,
} from "@/server/modules/roles";

const roleSchema = z
  .object({
    name: z.string(),
    permissions: z.array(z.string()),
  })
  .strict();

export const GET = createSessionAction(
  sessionOperations.roleList,
  async ({ orgId, userId, tenant }, request: Request) => {
    const roles = await createRequestRoleModule({
      orgId,
      userId,
      tenant,
      headers: request.headers,
    });
    return Response.json({
      roles: await roles.list(orgId),
      permissions: permissionOptions,
    });
  }
);

export const POST = createSessionAction(
  sessionOperations.roleCreate,
  async ({ orgId, userId, tenant }, request: Request) => {
    const parsed = roleSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid role" }, { status: 400 });

    const grantable = await getGrantablePermissions(parsed.data.permissions);
    const roles = await createRequestRoleModule({
      orgId,
      userId,
      tenant,
      headers: request.headers,
    });
    try {
      return Response.json(
        await roles.create({
          orgId,
          name: parsed.data.name,
          permissions: parsed.data.permissions,
          grantablePermissions: grantable,
        }),
        { status: 201 }
      );
    } catch (error) {
      return roleError(error);
    }
  }
);

async function getGrantablePermissions(permissions: string[]) {
  const allowed = await getAuthProvider().hasPermission(permissionRequestFor(permissions));
  return allowed ? permissions : [];
}

function roleError(error: unknown) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Role operation failed" },
    { status: 400 }
  );
}
