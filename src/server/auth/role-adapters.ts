import { admin, member, owner } from "../../../lib/permissions";
import type { AppMember, AppRole, RoleProvider } from "./role-provider";

type BetterRole = {
  id: string;
  role: string;
  permission: Record<string, string[]>;
};

type BetterMember = {
  id: string;
  userId: string;
  role: string;
  user?: { email?: string; name?: string };
};

type BetterRoleApi = {
  listOrgRoles(input: unknown): Promise<BetterRole[]>;
  createOrgRole(input: unknown): Promise<{ roleData: BetterRole }>;
  updateOrgRole(input: unknown): Promise<{ roleData: BetterRole }>;
  deleteOrgRole(input: unknown): Promise<unknown>;
  listMembers(input: unknown): Promise<{ members: BetterMember[] }>;
  updateMemberRole(input: unknown): Promise<unknown>;
  createInvitation(input: unknown): Promise<unknown>;
};

type WorkosRole = {
  id: string;
  name: string;
  slug: string;
  permissions: string[];
  type: "EnvironmentRole" | "OrganizationRole";
};

type WorkosMember = {
  id: string;
  userId: string;
  role: { slug: string };
};

type WorkosClient = {
  authorization: {
    listOrganizationRoles(orgId: string): Promise<{ data: WorkosRole[] }>;
    createOrganizationRole(
      orgId: string,
      input: { name: string; slug: string }
    ): Promise<WorkosRole>;
    updateOrganizationRole(
      orgId: string,
      slug: string,
      input: { name?: string }
    ): Promise<WorkosRole>;
    setOrganizationRolePermissions(
      orgId: string,
      slug: string,
      input: { permissions: string[] }
    ): Promise<unknown>;
    deleteOrganizationRole(orgId: string, slug: string): Promise<unknown>;
  };
  userManagement: {
    listOrganizationMemberships(input: {
      organizationId: string;
      limit: number;
    }): Promise<{ data: WorkosMember[] }>;
    getUser(userId: string): Promise<{
      email: string;
      firstName?: string | null;
      lastName?: string | null;
    }>;
    updateOrganizationMembership(memberId: string, input: { roleSlug: string }): Promise<unknown>;
    sendInvitation(input: {
      organizationId: string;
      email: string;
      roleSlug: string;
      inviterUserId: string;
    }): Promise<unknown>;
  };
};

export function createBetterRoleProvider(api: BetterRoleApi, headers: Headers): RoleProvider {
  const request = { headers };

  return {
    async listRoles(orgId) {
      const custom = await api.listOrgRoles({
        ...request,
        query: { organizationId: orgId },
      });
      return [...betterBuiltIns(), ...custom.map(toBetterRole)];
    },
    async createRole(input) {
      const result = await api.createOrgRole({
        ...request,
        body: {
          organizationId: input.orgId,
          role: input.slug,
          permission: toPermissionRequest(input.permissions),
        },
      });
      return { ...toBetterRole(result.roleData), name: input.name };
    },
    async updateRole(input) {
      const result = await api.updateOrgRole({
        ...request,
        body: {
          organizationId: input.orgId,
          roleId: input.id,
          data: {
            ...(input.name ? { roleName: toSlug(input.name) } : {}),
            ...(input.permissions ? { permission: toPermissionRequest(input.permissions) } : {}),
          },
        },
      });
      return { ...toBetterRole(result.roleData), name: input.name ?? result.roleData.role };
    },
    async deleteRole(input) {
      await api.deleteOrgRole({
        ...request,
        body: { organizationId: input.orgId, roleId: input.id },
      });
    },
    async listMembers(orgId) {
      const result = await api.listMembers({
        ...request,
        query: { organizationId: orgId, limit: 100 },
      });
      return result.members.map(toBetterMember);
    },
    async updateMemberRole(input) {
      await api.updateMemberRole({
        ...request,
        body: {
          organizationId: input.orgId,
          memberId: input.memberId,
          role: input.role,
        },
      });
    },
    async inviteMember(input) {
      await api.createInvitation({
        ...request,
        body: {
          organizationId: input.orgId,
          email: input.email,
          role: input.role,
        },
      });
    },
  };
}

export function createWorkosRoleProvider(client: WorkosClient): RoleProvider {
  return {
    async listRoles(orgId) {
      const result = await client.authorization.listOrganizationRoles(orgId);
      return result.data.map(toWorkosRole);
    },
    async createRole(input) {
      const role = await client.authorization.createOrganizationRole(input.orgId, {
        name: input.name,
        slug: input.slug,
      });
      await client.authorization.setOrganizationRolePermissions(input.orgId, role.slug, {
        permissions: input.permissions,
      });
      return { ...toWorkosRole(role), permissions: input.permissions };
    },
    async updateRole(input) {
      const current = await findWorkosRole(client, input.orgId, input.id);
      const role = input.name
        ? await client.authorization.updateOrganizationRole(input.orgId, current.slug, {
            name: input.name,
          })
        : current;
      if (input.permissions) {
        await client.authorization.setOrganizationRolePermissions(input.orgId, role.slug, {
          permissions: input.permissions,
        });
      }
      return {
        ...toWorkosRole(role),
        permissions: input.permissions ?? role.permissions,
      };
    },
    async deleteRole(input) {
      const role = await findWorkosRole(client, input.orgId, input.id);
      await client.authorization.deleteOrganizationRole(input.orgId, role.slug);
    },
    async listMembers(orgId) {
      const result = await client.userManagement.listOrganizationMemberships({
        organizationId: orgId,
        limit: 100,
      });
      return Promise.all(
        result.data.map(async (membership): Promise<AppMember> => {
          const user = await client.userManagement.getUser(membership.userId);
          return {
            id: membership.id,
            userId: membership.userId,
            email: user.email,
            name: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
            role: membership.role.slug,
          };
        })
      );
    },
    async updateMemberRole(input) {
      await client.userManagement.updateOrganizationMembership(input.memberId, {
        roleSlug: input.role,
      });
    },
    async inviteMember(input) {
      await client.userManagement.sendInvitation({
        organizationId: input.orgId,
        email: input.email,
        roleSlug: input.role,
        inviterUserId: input.inviterUserId,
      });
    },
  };
}

function betterBuiltIns(): AppRole[] {
  return [
    toBuiltIn("owner", owner.statements),
    toBuiltIn("admin", admin.statements),
    toBuiltIn("member", member.statements),
  ];
}

function toBuiltIn(slug: string, permission: Record<string, readonly string[]>): AppRole {
  return {
    id: slug,
    name: slug[0].toUpperCase() + slug.slice(1),
    slug,
    permissions: fromPermissionRequest(permission),
    builtIn: true,
  };
}

function toBetterRole(role: BetterRole): AppRole {
  return {
    id: role.id,
    name: role.role,
    slug: role.role,
    permissions: fromPermissionRequest(role.permission),
    builtIn: false,
  };
}

function toBetterMember(member: BetterMember): AppMember {
  return {
    id: member.id,
    userId: member.userId,
    email: member.user?.email,
    name: member.user?.name,
    role: member.role,
  };
}

function toWorkosRole(role: WorkosRole): AppRole {
  return {
    id: role.id,
    name: role.name,
    slug: role.slug,
    permissions: [...role.permissions].sort(),
    builtIn: role.type === "EnvironmentRole",
  };
}

async function findWorkosRole(client: WorkosClient, orgId: string, id: string) {
  const result = await client.authorization.listOrganizationRoles(orgId);
  const role = result.data.find((item) => item.id === id || item.slug === id);
  if (!role) throw new Error("Role not found");
  return role;
}

function fromPermissionRequest(permission: Record<string, readonly string[]>) {
  return Object.entries(permission)
    .flatMap(([resource, actions]) => actions.map((action) => `${resource}:${action}`))
    .sort();
}

function toPermissionRequest(permissions: string[]) {
  return permissions.reduce<Record<string, string[]>>((result, permission) => {
    const [resource, action] = permission.split(":");
    if (!resource || !action) return result;
    (result[resource] ??= []).push(action);
    return result;
  }, {});
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
