import { describe, expect, test } from "vitest";

import { clampDailyLimit, getProviderPolicy } from "../../../src/server/modules/providers";

describe("provider policies", () => {
  test("uses conservative cold-email defaults per provider", () => {
    expect(getProviderPolicy("google")).toMatchObject({
      recommendedDailyLimit: 20,
      maxSafeDailyLimit: 100,
      pollIntervalMs: 5 * 60 * 1000,
      retryClass: "oauth-rate-limited",
    });
    expect(getProviderPolicy("microsoft")).toMatchObject({
      recommendedDailyLimit: 20,
      maxSafeDailyLimit: 100,
      retryClass: "graph-retry-after",
    });
    expect(getProviderPolicy("smtp")).toMatchObject({
      recommendedDailyLimit: 25,
      maxSafeDailyLimit: 100,
      retryClass: "smtp-4xx-retry",
    });
    expect(getProviderPolicy("mailpool")).toMatchObject({
      recommendedDailyLimit: 50,
      maxSafeDailyLimit: 500,
      retryClass: "managed-pool",
    });
  });

  test("clamps requested daily limits to provider max", () => {
    expect(clampDailyLimit("google", 500)).toBe(100);
    expect(clampDailyLimit("smtp", 0)).toBe(1);
    expect(clampDailyLimit("mailpool", 250)).toBe(250);
  });
});
