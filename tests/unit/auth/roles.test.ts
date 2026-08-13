import { describe, expect, it, vi } from "vitest";

import { createRoleModule } from "@/server/modules/roles";
import type { RoleProvider } from "@/server/auth/role-provider";

function createProvider(): RoleProvider {
  return {
    listRoles: vi.fn(async () => []),
    createRole: vi.fn(async (input) => ({
      id: "role_1",
      name: input.name,
      slug: input.slug,
      permissions: input.permissions,
      builtIn: false,
    })),
    updateRole: vi.fn(async (input) => ({
      id: input.id,
      name: input.name ?? "Sales",
      slug: "sales",
      permissions: input.permissions ?? [],
      builtIn: false,
    })),
    deleteRole: vi.fn(async () => undefined),
    listMembers: vi.fn(async () => []),
    updateMemberRole: vi.fn(async () => undefined),
    inviteMember: vi.fn(async () => undefined),
  };
}

describe("role module", () => {
  it("creates a role with canonical permissions", async () => {
    const provider = createProvider();
    const audit = vi.fn(async () => undefined);
    const roles = createRoleModule(provider, audit);

    await roles.create({
      orgId: "org_1",
      name: "Campaign operator",
      permissions: ["campaign:read", "campaign:launch"],
      grantablePermissions: ["campaign:read", "campaign:launch", "contact:read"],
    });

    expect(provider.createRole).toHaveBeenCalledWith({
      orgId: "org_1",
      name: "Campaign operator",
      slug: "campaign-operator",
      permissions: ["campaign:launch", "campaign:read"],
    });
    expect(audit).toHaveBeenCalledWith("role.created", "Created role campaign-operator");
  });

  it("rejects unknown or ungrantable permissions", async () => {
    const roles = createRoleModule(createProvider());

    await expect(
      roles.create({
        orgId: "org_1",
        name: "Unsafe",
        permissions: ["campaign:delete"],
        grantablePermissions: ["campaign:read"],
      })
    ).rejects.toThrow("Cannot grant permissions: campaign:delete");

    await expect(
      roles.create({
        orgId: "org_1",
        name: "Unknown",
        permissions: ["root:everything"],
        grantablePermissions: ["root:everything"],
      })
    ).rejects.toThrow("Unknown permissions: root:everything");
  });

  it("protects built-in roles from update and delete", async () => {
    const provider = createProvider();
    vi.mocked(provider.listRoles).mockResolvedValue([
      {
        id: "workos_role_1",
        name: "Owner",
        slug: "owner",
        permissions: [],
        builtIn: true,
      },
    ]);
    const roles = createRoleModule(provider);

    await expect(
      roles.update({
        orgId: "org_1",
        id: "owner",
        name: "Changed",
        permissions: [],
        grantablePermissions: [],
      })
    ).rejects.toThrow("Built-in roles cannot be changed");
    await expect(roles.remove({ orgId: "org_1", id: "member" })).rejects.toThrow(
      "Built-in roles cannot be changed"
    );
    await expect(roles.remove({ orgId: "org_1", id: "workos_role_1" })).rejects.toThrow(
      "Built-in roles cannot be changed"
    );
  });

  it("reassigns members before deleting a custom role", async () => {
    const provider = createProvider();
    vi.mocked(provider.listRoles).mockResolvedValue([
      {
        id: "role_1",
        name: "Sales",
        slug: "sales",
        permissions: [],
        builtIn: false,
      },
    ]);
    vi.mocked(provider.listMembers).mockResolvedValue([
      { id: "member_1", userId: "user_1", role: "sales" },
      { id: "member_2", userId: "user_2", role: "member" },
    ]);
    const roles = createRoleModule(provider);

    await roles.remove({ orgId: "org_1", id: "role_1" });

    expect(provider.updateMemberRole).toHaveBeenCalledWith({
      orgId: "org_1",
      memberId: "member_1",
      role: "member",
    });
    expect(provider.deleteRole).toHaveBeenCalledWith({ orgId: "org_1", id: "role_1" });
  });

  it("prevents self-demotion and final-owner removal", async () => {
    const roles = createRoleModule(createProvider());

    await expect(
      roles.assign({
        orgId: "org_1",
        memberId: "member_1",
        memberUserId: "user_1",
        actorUserId: "user_1",
        currentRole: "owner",
        role: "member",
        ownerCount: 2,
      })
    ).rejects.toThrow("You cannot change your own role");

    await expect(
      roles.assign({
        orgId: "org_1",
        memberId: "member_1",
        memberUserId: "user_2",
        actorUserId: "user_1",
        currentRole: "owner",
        role: "member",
        ownerCount: 1,
      })
    ).rejects.toThrow("Organization must keep at least one owner");
  });
});
