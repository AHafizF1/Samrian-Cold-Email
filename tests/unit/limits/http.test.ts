import { describe, expect, it } from "vitest";

import { getClientIp, limitHeaders } from "../../../src/server/limits/http";

describe("HTTP rate limits", () => {
  it("uses direct connecting address unless trusted proxy mode is explicit", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.8, 10.0.0.2",
      "x-real-ip": "203.0.113.4",
    });

    expect(getClientIp(headers, "none")).toBe("unknown");
    expect(getClientIp(headers, "single")).toBe("198.51.100.8");
  });

  it("rejects malformed forwarded addresses", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "not an ip" }), "single")).toBe("unknown");
  });

  it("returns RateLimit-Reset as seconds until reset", () => {
    expect(
      limitHeaders(
        {
          allowed: true,
          policyId: "api.read",
          limit: 10,
          remaining: 9,
          retryAfterMs: 0,
          resetAt: 15_000,
        },
        () => 5_000
      )
    ).toMatchObject({ "ratelimit-reset": "10" });
  });
});
