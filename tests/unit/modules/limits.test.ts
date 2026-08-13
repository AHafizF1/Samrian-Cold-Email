import { describe, expect, it } from "vitest";

import {
  createLimitGuard,
  getOperationPolicy,
  getTierLimits,
  type RateLimiter,
} from "../../../src/server/modules/limits";
import { MemoryRateLimiter } from "../../../src/server/limits/memory";

describe("rate limits", () => {
  it("assigns stable weighted policies by operation cost", () => {
    expect(getOperationPolicy("contacts.list")).toMatchObject({
      id: "api.read",
      units: 1,
    });
    expect(getOperationPolicy("contacts.import")).toMatchObject({
      id: "api.bulk",
      units: 10,
    });
    expect(getOperationPolicy("domains.check")).toMatchObject({
      id: "api.provider-check",
      units: 20,
    });
    expect(getOperationPolicy("campaigns.launch")).toMatchObject({
      id: "api.high-impact",
      units: 50,
    });
  });

  it("defines public auth, OAuth, and tracking policies", () => {
    expect(getOperationPolicy("auth.sign-in")).toMatchObject({ id: "public.auth" });
    expect(getOperationPolicy("oauth.google.callback")).toMatchObject({ id: "public.oauth" });
    expect(getOperationPolicy("tracking.click")).toMatchObject({ id: "public.tracking" });
  });

  it("keeps paid tiers generous while preserving finite hard bounds", () => {
    expect(getTierLimits("starter").hourlyUnits).toBe(20_000);
    expect(getTierLimits("pro").hourlyUnits).toBe(75_000);
    expect(getTierLimits("business").hourlyUnits).toBe(250_000);
    expect(getTierLimits("business").hourlyUnits).toBeLessThanOrEqual(500_000);
    expect(getTierLimits("enterprise").hourlyUnits).toBe(500_000);
    expect(getTierLimits("self-hosted").hourlyUnits).toBe(500_000);
  });

  it("isolates counters by organization, credential, and policy", async () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter(() => now);
    const input = {
      policyId: "api.test",
      limit: 1,
      windowMs: 60_000,
      cost: 1,
    };

    await expect(limiter.consume({ ...input, subject: "org:a:key:1" })).resolves.toMatchObject({
      allowed: true,
    });
    await expect(limiter.consume({ ...input, subject: "org:a:key:1" })).resolves.toMatchObject({
      allowed: false,
    });
    await expect(limiter.consume({ ...input, subject: "org:a:key:2" })).resolves.toMatchObject({
      allowed: true,
    });
    await expect(limiter.consume({ ...input, subject: "org:b:key:1" })).resolves.toMatchObject({
      allowed: true,
    });

    now += 60_000;
    await expect(limiter.consume({ ...input, subject: "org:a:key:1" })).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("enforces credential and organization budgets together", async () => {
    const calls: string[] = [];
    const limiter: RateLimiter = {
      consume: async (input) => {
        calls.push(input.subject);
        return input.subject.startsWith("org:") && !input.subject.includes(":credential:")
          ? denied(input.limit)
          : allowed(input.limit);
      },
    };
    const guard = createLimitGuard({ limiter, mode: "enforce", tier: "starter" });

    const result = await guard.check({
      operationId: "contacts.list",
      orgId: "org_1",
      credentialId: "key_1",
    });

    expect(result.allowed).toBe(false);
    expect(result.policyId).toBe("org.hourly");
    expect(calls).toEqual([
      "org:org_1:credential:key_1:api.read",
      "org:org_1:hourly",
      "org:org_1:burst",
    ]);
  });

  it("shadow mode records denial without blocking", async () => {
    const guard = createLimitGuard({
      limiter: { consume: async () => denied(1) },
      mode: "shadow",
      tier: "starter",
    });

    await expect(
      guard.check({ operationId: "contacts.list", orgId: "org_1", credentialId: "key_1" })
    ).resolves.toMatchObject({ allowed: true, shadowed: true });
  });

  it("applies adaptive penalty units to abusive public failures", async () => {
    const calls: number[] = [];
    const guard = createLimitGuard({
      limiter: {
        consume: async (input) => {
          calls.push(input.cost);
          return allowed(input.limit);
        },
      },
      mode: "enforce",
      tier: "starter",
    });

    await guard.checkPublic({
      operationId: "auth.sign-in",
      subject: "203.0.113.2",
      penalty: true,
    });

    expect(calls).toEqual([5]);
  });
});

function allowed(limit: number) {
  return { allowed: true as const, limit, remaining: limit - 1, retryAfterMs: 0, resetAt: 2_000 };
}

function denied(limit: number) {
  return { allowed: false as const, limit, remaining: 0, retryAfterMs: 1_000, resetAt: 2_000 };
}
