import { describe, expect, it, vi } from "vitest";

import { RedisRateLimiter } from "../../../src/server/limits/redis";

describe("RedisRateLimiter", () => {
  it("connects a lazy Redis client before its first command", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const evalScript = vi.fn().mockResolvedValue([1, 9, 60_000]);
    const limiter = new RedisRateLimiter(
      { status: "wait", connect, eval: evalScript } as never,
      "samrian:test"
    );

    await limiter.consume({
      policyId: "api.read",
      subject: "credential:one",
      limit: 10,
      windowMs: 60_000,
      cost: 1,
    });

    expect(connect).toHaveBeenCalledOnce();
    expect(evalScript).toHaveBeenCalledOnce();
  });

  it("uses one atomic script and maps its decision", async () => {
    const evalScript = vi.fn().mockResolvedValue([1, 4, 45_000]);
    const limiter = new RedisRateLimiter({ eval: evalScript } as never, "samrian:test");

    await expect(
      limiter.consume({
        policyId: "org.hourly",
        subject: "org:one",
        limit: 10,
        windowMs: 60_000,
        cost: 2,
      })
    ).resolves.toMatchObject({
      allowed: true,
      limit: 10,
      remaining: 4,
      retryAfterMs: 0,
    });
    expect(evalScript).toHaveBeenCalledOnce();
    expect(evalScript.mock.calls[0]?.slice(1)).toEqual([
      1,
      "samrian:test:org.hourly:org:one",
      "2",
      "60000",
      "10",
    ]);
  });

  it("returns retry timing when capacity is exhausted", async () => {
    const limiter = new RedisRateLimiter(
      { eval: vi.fn().mockResolvedValue([0, 0, 9_000]) } as never,
      "samrian:test"
    );

    await expect(
      limiter.consume({
        policyId: "api.read",
        subject: "credential:one",
        limit: 10,
        windowMs: 60_000,
        cost: 1,
      })
    ).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterMs: 9_000,
    });
  });
});
