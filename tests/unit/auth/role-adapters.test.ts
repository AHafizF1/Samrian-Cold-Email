import { describe, expect, it, vi } from "vitest";

import { createBetterRoleProvider, createWorkosRoleProvider } from "@/server/auth/role-adapters";

describe("role provider adapters", () => {
  it("maps Better Auth roles to app roles", async () => {
    const api = {
      listOrgRoles: vi.fn(async () => [
        {
          id: "role_1",
          role: "sales",
          permission: { campaign: ["read"], contact: ["read"] },
        },
      ]),
    };

    const provider = createBetterRoleProvider(api as never, new Headers());
    const roles = await provider.listRoles("org_1");

    expect(roles.find((role) => role.slug === "sales")).toEqual({
      id: "role_1",
      name: "sales",
      slug: "sales",
      permissions: ["campaign:read", "contact:read"],
      builtIn: false,
    });
    expect(roles.filter((role) => role.builtIn).map((role) => role.slug)).toEqual([
      "owner",
      "admin",
      "member",
    ]);
  });

  it("creates WorkOS role then applies canonical permissions", async () => {
    const authorization = {
      createOrganizationRole: vi.fn(async () => ({
        id: "role_1",
        name: "Sales",
        slug: "sales",
        permissions: [],
        type: "OrganizationRole",
      })),
      setOrganizationRolePermissions: vi.fn(async () => undefined),
    };

    const provider = createWorkosRoleProvider({
      authorization,
      userManagement: {},
    } as never);
    const role = await provider.createRole({
      orgId: "org_1",
      name: "Sales",
      slug: "sales",
      permissions: ["campaign:read"],
    });

    expect(authorization.createOrganizationRole).toHaveBeenCalledWith("org_1", {
      name: "Sales",
      slug: "sales",
    });
    expect(authorization.setOrganizationRolePermissions).toHaveBeenCalledWith("org_1", "sales", {
      permissions: ["campaign:read"],
    });
    expect(role.permissions).toEqual(["campaign:read"]);
  });
});
