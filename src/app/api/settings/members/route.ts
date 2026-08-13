import { z } from "zod";

import { createSessionAction } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { getAuthProvider } from "@/server/auth/provider";
import { createRequestRoleModule, permissionRequestFor } from "@/server/modules/roles";

const updateSchema = z
  .object({
    memberId: z.string().min(1),
    role: z.string().min(1),
  })
  .strict();

export const GET = createSessionAction(
  sessionOperations.memberList,
  async ({ orgId, userId, tenant }, request: Request) => {
    const roles = await createRequestRoleModule({
      orgId,
      userId,
      tenant,
      headers: request.headers,
    });
    return Response.json(await roles.listMembers(orgId));
  }
);

export const PATCH = createSessionAction(
  sessionOperations.memberUpdate,
  async ({ orgId, userId, tenant }, request: Request) => {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid member role" }, { status: 400 });
    const roles = await createRequestRoleModule({
      orgId,
      userId,
      tenant,
      headers: request.headers,
    });
    const members = await roles.listMembers(orgId);
    const member = members.find((item) => item.id === parsed.data.memberId);
    if (!member) return Response.json({ error: "Member not found" }, { status: 404 });
    const role = (await roles.list(orgId)).find((item) => item.slug === parsed.data.role);
    if (!role) return Response.json({ error: "Role not found" }, { status: 404 });
    if (!(await getAuthProvider().hasPermission(permissionRequestFor(role.permissions)))) {
      return Response.json({ error: "Cannot assign this role" }, { status: 403 });
    }

    try {
      await roles.assign({
        orgId,
        memberId: member.id,
        memberUserId: member.userId,
        actorUserId: userId,
        currentRole: member.role,
        role: parsed.data.role,
        ownerCount: members.filter((item) => item.role === "owner").length,
      });
      return Response.json({ updated: true });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Member update failed" },
        { status: 400 }
      );
    }
  }
);
