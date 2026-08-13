import { describe, expect, it } from "vitest";

import { readLimitConfig } from "../../../src/server/limits/config";

describe("rate-limit config", () => {
  it("defaults to disabled locally and enforced in production", () => {
    expect(readLimitConfig({ NODE_ENV: "development" }).mode).toBe("off");
    expect(
      readLimitConfig({
        NODE_ENV: "production",
        RATE_LIMIT_PROVIDER: "redis",
        REDIS_URL: "redis://localhost:6379",
        TRUSTED_PROXY_MODE: "single",
      }).mode
    ).toBe("enforce");
  });

  it("requires a trusted proxy for enforced production IP limits", () => {
    expect(() =>
      readLimitConfig({
        NODE_ENV: "production",
        RATE_LIMIT_PROVIDER: "redis",
        REDIS_URL: "redis://localhost:6379",
      })
    ).toThrow("TRUSTED_PROXY_MODE");
  });

  it("requires Redis in enforced production mode", () => {
    expect(() => readLimitConfig({ NODE_ENV: "production", RATE_LIMIT_PROVIDER: "redis" })).toThrow(
      "REDIS_URL"
    );
  });

  it("validates tier and emergency multiplier without leaking values", () => {
    expect(() => readLimitConfig({ RATE_LIMIT_TIER: "free" })).toThrow("RATE_LIMIT_TIER");
    expect(() => readLimitConfig({ RATE_LIMIT_EMERGENCY_MULTIPLIER: "2" })).toThrow(
      "RATE_LIMIT_EMERGENCY_MULTIPLIER"
    );
  });
});
