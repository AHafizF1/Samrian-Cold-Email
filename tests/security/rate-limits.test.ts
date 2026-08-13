import { describe, expect, test, vi } from "vitest";

import { createLimitGuard } from "../../src/server/modules/limits";
import type { Logger } from "../../src/server/observability/logs";

describe("rate-limit security matrix", () => {
  test("logs denial without credential or payload leakage", async () => {
    const warn = vi.fn();
    const logger = { warn } as unknown as Logger;
    const guard = createLimitGuard({
      mode: "enforce",
      tier: "starter",
      logger,
      limiter: {
        consume: async (input) => ({
          allowed: false,
          limit: input.limit,
          remaining: 0,
          retryAfterMs: 1_000,
          resetAt: 2_000,
        }),
      },
    });

    await guard.check({
      operationId: "contacts.import",
      orgId: "org_1",
      credentialId: "sam_secret",
    });

    expect(warn).toHaveBeenCalledWith(
      "rate_limit.denied",
      expect.objectContaining({ policyId: expect.any(String), subjectType: "credential" })
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("sam_secret");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("org_1");
  });
});
