import type { AutomationPrincipal } from "../../src/server/auth/machine";

export const securityFixtures = {
  orgA: { id: "org_a", owner: "user_a_owner", admin: "user_a_admin", member: "user_a_member" },
  orgB: { id: "org_b", owner: "user_b_owner", admin: "user_b_admin", member: "user_b_member" },
} as const;

export function roleFixtures(org: typeof securityFixtures.orgA | typeof securityFixtures.orgB) {
  return [
    { role: "owner" as const, userId: org.owner },
    { role: "admin" as const, userId: org.admin },
    { role: "member" as const, userId: org.member },
  ];
}

export function expectHiddenCrossOrg(resourceOrgId: string, actorOrgId: string) {
  return resourceOrgId === actorOrgId ? "allowed" : "not-found";
}

export const protectedFields = [
  "orgId",
  "userId",
  "role",
  "encryptedPassword",
  "encryptedAccessToken",
  "encryptedRefreshToken",
] as const;

export function principal(
  orgId = securityFixtures.orgA.id,
  scopes: AutomationPrincipal["scopes"] = ["identity:read"]
): AutomationPrincipal {
  return {
    credentialId: `key_${orgId}`,
    provider: "better-auth",
    orgId,
    userId: `${orgId}_owner`,
    scopes,
  };
}
