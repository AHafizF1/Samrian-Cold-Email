import { describe, expect, test } from "vitest";

import {
  requireActiveOrg,
  requireOrgAccess,
  requireSession,
  verifyOrgOwnership,
} from "../../src/server/auth/session";

describe("Postgres auth sessions", () => {
  test("rejects unauthenticated request", async () => {
    await expect(requireSession({ getSession: async () => null })).rejects.toThrow("Unauthorized");
  });

  test("rejects user without active org", async () => {
    await expect(
      requireActiveOrg({
        getSession: async () => ({
          user: { id: "user_1", email: "ada@example.com" },
          session: { activeOrganizationId: null },
        }),
      })
    ).rejects.toThrow("No active organization");
  });

  test("returns active org context for member", async () => {
    await expect(
      requireActiveOrg({
        getSession: async () => ({
          user: { id: "user_1", email: "ada@example.com" },
          session: { activeOrganizationId: "org_1" },
        }),
        getMember: async () => ({ role: "admin" }),
      })
    ).resolves.toEqual({
      userId: "user_1",
      orgId: "org_1",
      role: "admin",
    });
  });

  test("rejects active org when user is not a member", async () => {
    await expect(
      requireActiveOrg({
        getSession: async () => ({
          user: { id: "user_1", email: "ada@example.com" },
          session: { activeOrganizationId: "org_1" },
        }),
        getMember: async () => null,
      })
    ).rejects.toThrow("No active organization");
  });

  test("checks permissions when requested", async () => {
    await expect(
      requireOrgAccess(
        {
          getSession: async () => ({
            user: { id: "user_1", email: "ada@example.com" },
            session: { activeOrganizationId: "org_1" },
          }),
          getMember: async () => ({ role: "member" }),
          hasPermission: async () => false,
        },
        { campaign: ["delete"] }
      )
    ).rejects.toThrow("Missing permissions");
  });

  test("verifies org ownership without leaking cross-org resources", async () => {
    await expect(verifyOrgOwnership(null, "org_1", "Campaign")).rejects.toThrow(
      "Campaign not found"
    );
    await expect(
      verifyOrgOwnership({ id: "campaign_1", orgId: "org_2" }, "org_1", "Campaign")
    ).rejects.toThrow("Campaign not found");
    await expect(
      verifyOrgOwnership({ id: "campaign_1", orgId: "org_1" }, "org_1", "Campaign")
    ).resolves.toMatchObject({ id: "campaign_1" });
  });
});
