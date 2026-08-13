import { describe, expect, test, vi } from "vitest";

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(),
}));

describe("WorkOS auth adapter", () => {
  test("maps WorkOS session claims into app auth session", async () => {
    const { withAuth } = await import("@workos-inc/authkit-nextjs");
    vi.mocked(withAuth).mockResolvedValue({
      user: { id: "user_1", email: "ada@example.com" },
      organizationId: "org_1",
      role: "admin",
      roles: ["admin"],
      permissions: ["campaign:read", "campaign:delete"],
      accessToken: "token",
      sessionId: "session_1",
    } as never);

    const { createWorkosProvider } = await import("../../src/server/auth/workos");
    const provider = createWorkosProvider();

    await expect(provider.getSession()).resolves.toEqual({
      user: { id: "user_1", email: "ada@example.com" },
      session: {
        activeOrganizationId: "org_1",
        roles: ["admin"],
        permissions: ["campaign:read", "campaign:delete"],
      },
    });
  });

  test("uses first WorkOS role as app role", async () => {
    const { withAuth } = await import("@workos-inc/authkit-nextjs");
    vi.mocked(withAuth).mockResolvedValue({
      user: { id: "user_1", email: "ada@example.com" },
      organizationId: "org_1",
      roles: ["owner", "admin"],
      permissions: [],
    } as never);

    const { createWorkosProvider } = await import("../../src/server/auth/workos");
    const provider = createWorkosProvider();

    await expect(provider.getActiveOrg()).resolves.toEqual({
      userId: "user_1",
      orgId: "org_1",
      role: "owner",
      roles: ["owner", "admin"],
      permissions: [],
    });
  });

  test("checks app permission requests against WorkOS permissions", async () => {
    const { withAuth } = await import("@workos-inc/authkit-nextjs");
    vi.mocked(withAuth).mockResolvedValue({
      user: { id: "user_1", email: "ada@example.com" },
      organizationId: "org_1",
      roles: ["member"],
      permissions: ["campaign:read", "contact:create"],
    } as never);

    const { createWorkosProvider } = await import("../../src/server/auth/workos");
    const provider = createWorkosProvider();

    await expect(provider.hasPermission({ campaign: ["read"] })).resolves.toBe(true);
    await expect(provider.hasPermission({ campaign: ["delete"] })).resolves.toBe(false);
  });
});
