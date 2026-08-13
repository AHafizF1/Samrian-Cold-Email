import { permissionCatalog } from "../../../lib/permissions";
import type { RoleProvider } from "../auth/role-provider";
import { getRoleProvider } from "../auth/role-provider-factory";
import type { DbTransaction } from "../db/tx";
import { PostgresAuditRepo } from "../repos/audit";

const builtInRoles = new Set(["owner", "admin", "member"]);
const knownPermissions = new Set(
  Object.entries(permissionCatalog).flatMap(([resource, actions]) =>
    actions.map((action) => `${resource}:${action}`)
  )
);

export const permissionOptions = [...knownPermissions].sort();

export function permissionRequestFor(values: string[]) {
  return values.reduce<Record<string, string[]>>((result, permission) => {
    const [resource, action] = permission.split(":");
    if (resource && action) (result[resource] ??= []).push(action);
    return result;
  }, {});
}

type RoleAudit = (action: string, details: string) => Promise<void>;

export function createRoleModule(provider: RoleProvider, audit?: RoleAudit) {
  return {
    list: (orgId: string) => provider.listRoles(orgId),
    listMembers: (orgId: string) => provider.listMembers(orgId),
    async create(input: {
      orgId: string;
      name: string;
      permissions: string[];
      grantablePermissions: string[];
    }) {
      const name = validateName(input.name);
      const permissions = validatePermissions(input.permissions, input.grantablePermissions);
      const slug = toSlug(name);

      if (builtInRoles.has(slug)) {
        throw new Error("Built-in role names are reserved");
      }

      const role = await provider.createRole({ orgId: input.orgId, name, slug, permissions });
      await audit?.("role.created", `Created role ${role.slug}`);
      return role;
    },
    async update(input: {
      orgId: string;
      id: string;
      name?: string;
      permissions?: string[];
      grantablePermissions: string[];
    }) {
      protectBuiltIn(input.id);
      const existing = (await provider.listRoles(input.orgId)).find((role) => role.id === input.id);
      if (!existing) throw new Error("Role not found");
      if (existing.builtIn) throw new Error("Built-in roles cannot be changed");
      const name = input.name === undefined ? undefined : validateName(input.name);
      const permissions =
        input.permissions === undefined
          ? undefined
          : validatePermissions(input.permissions, input.grantablePermissions);
      const role = await provider.updateRole({
        orgId: input.orgId,
        id: input.id,
        name,
        permissions,
      });
      await audit?.("role.updated", `Updated role ${role.slug}`);
      return role;
    },
    async remove(input: { orgId: string; id: string }) {
      protectBuiltIn(input.id);
      const roles = await provider.listRoles(input.orgId);
      const role = roles.find((item) => item.id === input.id);
      if (!role) throw new Error("Role not found");
      if (role.builtIn) throw new Error("Built-in roles cannot be changed");
      const members = await provider.listMembers(input.orgId);
      await Promise.all(
        members
          .filter((member) => member.role === role.slug)
          .map((member) =>
            provider.updateMemberRole({
              orgId: input.orgId,
              memberId: member.id,
              role: "member",
            })
          )
      );
      await provider.deleteRole(input);
      await audit?.("role.deleted", `Deleted role ${role.slug}`);
    },
    async assign(input: {
      orgId: string;
      memberId: string;
      memberUserId: string;
      actorUserId: string;
      currentRole: string;
      role: string;
      ownerCount: number;
    }) {
      if (input.currentRole !== input.role && input.memberUserId === input.actorUserId) {
        throw new Error("You cannot change your own role");
      }
      if (input.currentRole === "owner" && input.role !== "owner" && input.ownerCount <= 1) {
        throw new Error("Organization must keep at least one owner");
      }
      await provider.updateMemberRole({
        orgId: input.orgId,
        memberId: input.memberId,
        role: input.role,
      });
      await audit?.("member.role-updated", `Assigned member ${input.memberId} to ${input.role}`);
    },
    invite(input: { orgId: string; email: string; role: string; inviterUserId: string }) {
      if (!input.email.trim()) throw new Error("Email is required");
      const email = input.email.trim().toLowerCase();
      return provider
        .inviteMember({ ...input, email })
        .then(() => audit?.("member.invited", `Invited ${email} as ${input.role}`));
    },
  };
}

export async function createRequestRoleModule(input: {
  orgId: string;
  userId: string;
  headers: Headers;
  tenant<T>(operation: (db: DbTransaction) => Promise<T>): Promise<T>;
}) {
  const provider = await getRoleProvider(input.headers);
  return createRoleModule(provider, (action, details) =>
    input
      .tenant((db) =>
        new PostgresAuditRepo(db).create({
          orgId: input.orgId,
          userId: input.userId,
          action,
          details,
        })
      )
      .then(() => undefined)
  );
}

function validateName(value: string) {
  const name = value.trim();
  if (name.length < 2 || name.length > 50) {
    throw new Error("Role name must be 2 to 50 characters");
  }
  return name;
}

function validatePermissions(values: string[], grantable: string[]) {
  const permissions = [...new Set(values)].sort();
  const unknown = permissions.filter((permission) => !knownPermissions.has(permission));
  if (unknown.length) throw new Error(`Unknown permissions: ${unknown.join(", ")}`);

  const allowed = new Set(grantable);
  const denied = permissions.filter((permission) => !allowed.has(permission));
  if (denied.length) throw new Error(`Cannot grant permissions: ${denied.join(", ")}`);
  return permissions;
}

function protectBuiltIn(id: string) {
  if (builtInRoles.has(id)) throw new Error("Built-in roles cannot be changed");
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
