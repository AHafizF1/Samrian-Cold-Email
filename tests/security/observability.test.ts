import { describe, expect, test, vi } from "vitest";

import { createApiRoute } from "../../src/server/api/route";
import { apiRequest, credential } from "./request";

describe("security observability", () => {
  test("denied credential preserves scanner request and correlation IDs", async () => {
    const warn = vi.fn();
    const route = createApiRoute({
      operation: "identity.me",
      credentials: credential(null),
      logger: { info: vi.fn(), warn, error: vi.fn() },
      handler: async () => ({ data: {} }),
      tenant: async (_context, operation) => operation(undefined as never),
    });
    const response = await route(
      apiRequest("/api/v1/me", {
        token: "invalid",
        headers: { "x-request-id": "sec_request", "x-correlation-id": "sec_run" },
      })
    );
    expect(response.headers.get("x-request-id")).toBe("sec_request");
    expect(response.headers.get("x-correlation-id")).toBe("sec_run");
    expect(warn).toHaveBeenCalledWith(
      "credential.rejected",
      expect.objectContaining({ requestId: "sec_request" })
    );
  });
});
