import { z } from "zod";

import { createSessionAction } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { getAuthProvider } from "@/server/auth/provider";
import { createRequestRoleModule, permissionRequestFor } from "@/server/modules/roles";

const inviteSchema = z
  .object({
    email: z.string().email(),
    role: z.string().min(1),
  })
  .strict();

export const POST = createSessionAction(
  sessionOperations.memberInvite,
  async ({ orgId, userId, tenant }, request: Request) => {
    const parsed = inviteSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid invitation" }, { status: 400 });
    const roles = await createRequestRoleModule({
      orgId,
      userId,
      tenant,
      headers: request.headers,
    });
    const role = (await roles.list(orgId)).find((item) => item.slug === parsed.data.role);
    if (!role) return Response.json({ error: "Role not found" }, { status: 404 });
    if (!(await getAuthProvider().hasPermission(permissionRequestFor(role.permissions)))) {
      return Response.json({ error: "Cannot assign this role" }, { status: 403 });
    }
    await roles.invite({
      orgId,
      inviterUserId: userId,
      ...parsed.data,
    });
    return Response.json({ invited: true }, { status: 201 });
  }
);
