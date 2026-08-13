import { describe, expect, test, vi } from "vitest";

import { getDomainReadiness, normalizeDomain } from "../../../src/server/modules/domains";

vi.mock("../../../src/server/deliverability/dns", () => ({
  checkDomain: vi.fn(async (domain: string) => ({
    domain,
    source: "dns",
    status: "pass",
    checks: { mx: "pass", spf: "pass", dmarc: "pass", dkim: "pass" },
    issues: [],
    warnings: [],
    checkedAt: 10_000,
  })),
}));

describe("domain readiness module", () => {
  test("normalizes valid domains and rejects invalid domains", () => {
    expect(normalizeDomain(" Example.COM ")).toBe("example.com");
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("bad_domain.com")).toBeNull();
    expect(normalizeDomain("-bad.com")).toBeNull();
  });

  test("uses fresh cached readiness", async () => {
    const saved: unknown[] = [];
    await expect(
      getDomainReadiness(
        { orgId: "org_1", domain: "example.com" },
        {
          now: () => 12_000,
          domains: {
            get: async () => ({
              domain: "example.com",
              source: "dns",
              status: "warn",
              checks: { mx: "pass", spf: "warn", dmarc: "warn", dkim: "warn" },
              issues: [],
              warnings: ["SPF record not found"],
              checkedAt: 11_000,
            }),
            upsert: async (input) => {
              saved.push(input);
            },
          },
        }
      )
    ).resolves.toMatchObject({ cached: true, status: "warn" });

    expect(saved).toEqual([]);
  });

  test("checks and stores stale readiness", async () => {
    const saved: unknown[] = [];
    await expect(
      getDomainReadiness(
        { orgId: "org_1", domain: "example.com" },
        {
          now: () => 99_999_999,
          domains: {
            get: async () => null,
            upsert: async (input) => {
              saved.push(input);
            },
          },
        }
      )
    ).resolves.toMatchObject({ cached: false, status: "pass" });

    expect(saved).toHaveLength(1);
  });
});
