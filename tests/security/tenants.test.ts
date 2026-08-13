import { describe, expect, test } from "vitest";

import { createApiRoute, ApiRouteError } from "../../src/server/api/route";
import { apiRequest, credential } from "./request";
import { expectHiddenCrossOrg, principal, securityFixtures } from "./fixtures";

describe("tenant isolation", () => {
  test("wrong-org resource is indistinguishable from missing resource", async () => {
    const actor = principal(securityFixtures.orgA.id, ["contacts:read"]);
    const route = createApiRoute({
      operation: "contacts.get",
      credentials: credential(actor),
      tenant: async (_context, operation) => operation(undefined as never),
      handler: async ({ principal: caller }) => {
        const resourceOrg = securityFixtures.orgB.id;
        if (expectHiddenCrossOrg(resourceOrg, caller.orgId) === "not-found") {
          throw new ApiRouteError("NOT_FOUND", "Contact not found", 404);
        }
        return { data: {} };
      },
    });
    const response = await route(apiRequest("/api/v1/contacts/contact_b", { token: "key" }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_FOUND", message: "Contact not found" },
    });
  });
});
