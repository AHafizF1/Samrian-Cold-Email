import { describe, expect, test, vi } from "vitest";
import { operations, scopes } from "@samrian/contracts";

import { createApiRoute } from "../../src/server/api/route";
import { apiRequest, credential } from "./request";
import { principal } from "./fixtures";

describe("API scopes", () => {
  test("every operation uses canonical non-empty scopes", () => {
    for (const operation of operations) {
      expect(operation.scopes.length).toBeGreaterThan(0);
      expect(operation.scopes.every((scope) => scopes.includes(scope))).toBe(true);
    }
  });

  test("missing scope returns 403 before handler", async () => {
    const handler = vi.fn(async () => ({ data: {} }));
    const route = createApiRoute({
      operation: "campaigns.launch",
      credentials: credential(principal("org_a", ["campaigns:read"])),
      handler,
      tenant: async (_context, operation) => operation(undefined as never),
    });
    const response = await route(
      apiRequest("/api/v1/campaigns/campaign_1/launch", {
        method: "POST",
        token: "key",
        headers: { "idempotency-key": "launch_1" },
      })
    );
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});
