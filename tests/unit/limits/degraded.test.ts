import { describe, expect, test, vi } from "vitest";

import {
  DegradedRateLimiter,
  RateLimitUnavailableError,
} from "../../../src/server/limits/degraded";

const input = {
  policyId: "api.read",
  subject: "user:one",
  limit: 10,
  windowMs: 60_000,
  cost: 1,
};

describe("degraded rate limiting", () => {
  test("uses local fallback for ordinary authenticated traffic", async () => {
    const fallback = { consume: vi.fn().mockResolvedValue({ allowed: true }) };
    const limiter = new DegradedRateLimiter(
      { consume: vi.fn().mockRejectedValue(new Error("Redis unavailable")) },
      fallback as never
    );

    await expect(limiter.consume(input)).resolves.toEqual({ allowed: true });
    expect(fallback.consume).toHaveBeenCalledWith(input);
  });

  test.each(["public.auth", "public.token", "api.high-impact", "api.provider-check"])(
    "fails closed for %s",
    async (policyId) => {
      const limiter = new DegradedRateLimiter(
        { consume: vi.fn().mockRejectedValue(new Error("Redis unavailable")) },
        { consume: vi.fn() } as never
      );

      await expect(limiter.consume({ ...input, policyId })).rejects.toBeInstanceOf(
        RateLimitUnavailableError
      );
    }
  );

  test("returns to Redis after recovery", async () => {
    const primary = {
      consume: vi
        .fn()
        .mockRejectedValueOnce(new Error("Redis unavailable"))
        .mockResolvedValueOnce({ allowed: true, remaining: 8 }),
    };
    const fallback = { consume: vi.fn().mockResolvedValue({ allowed: true, remaining: 9 }) };
    const limiter = new DegradedRateLimiter(primary as never, fallback as never);

    await expect(limiter.consume(input)).resolves.toMatchObject({ remaining: 9 });
    await expect(limiter.consume(input)).resolves.toMatchObject({ remaining: 8 });
    expect(primary.consume).toHaveBeenCalledTimes(2);
  });
});
