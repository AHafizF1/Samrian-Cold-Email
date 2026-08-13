import { withAuth } from "@workos-inc/authkit-nextjs";

import type { AuthContext, OrgRole, PermissionRequest, SessionData } from "./types";
import type { AuthProvider } from "./port";

type WorkosSession = Awaited<ReturnType<typeof withAuth>>;

export function createWorkosProvider(): AuthProvider {
  async function getWorkosSession(): Promise<WorkosSession> {
    return await withAuth();
  }

  return {
    async getSession() {
      const session = await getWorkosSession();

      if (!session.user) {
        return null;
      }

      return mapWorkosSession(session);
    },
    async getActiveOrg() {
      const session = await getWorkosSession();

      if (!session.user || !session.organizationId) {
        return null;
      }

      return mapWorkosContext(session);
    },
    async hasPermission(permissions) {
      const session = await getWorkosSession();

      if (!session.user) {
        return false;
      }

      return hasWorkosPermissions(session.permissions ?? [], permissions);
    },
  };
}

function mapWorkosSession(session: WorkosSession): SessionData | null {
  if (!session.user) {
    return null;
  }

  const user: SessionData["user"] = {
    id: session.user.id,
    email: session.user.email,
    name: getWorkosName(session.user),
    image: session.user.profilePictureUrl,
  };

  if (!user.name) {
    delete user.name;
  }

  if (!user.image) {
    delete user.image;
  }

  return {
    user,
    session: {
      activeOrganizationId: session.organizationId ?? null,
      roles: getWorkosRoles(session),
      permissions: session.permissions ?? [],
    },
  };
}

function mapWorkosContext(session: WorkosSession): AuthContext | null {
  if (!session.user || !session.organizationId) {
    return null;
  }

  const roles = getWorkosRoles(session);

  return {
    userId: session.user.id,
    orgId: session.organizationId,
    role: roles[0] ?? "member",
    roles,
    permissions: session.permissions ?? [],
  };
}

function getWorkosRoles(session: WorkosSession): OrgRole[] {
  if (!session.user) {
    return [];
  }

  return session.roles?.length ? session.roles : session.role ? [session.role] : ["member"];
}

function getWorkosName(user: NonNullable<WorkosSession["user"]>): string | null {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || null;
}

export function hasWorkosPermissions(
  actualPermissions: string[],
  requested: PermissionRequest
): boolean {
  return Object.entries(requested).every(([resource, actions]) =>
    actions.every((action) => actualPermissions.includes(`${resource}:${action}`))
  );
}
