import { describe, expect, test } from "vitest";

import { checkDomain } from "../../../src/server/deliverability/dns";

describe("domain DNS readiness", () => {
  test("returns pass when MX, SPF, DMARC, and DKIM are present", async () => {
    await expect(
      checkDomain("example.com", {
        resolveMx: async () => [{ exchange: "mx.example.com", priority: 10 }],
        resolveTxt: async (name) => {
          if (name === "example.com") return [["v=spf1 include:_spf.example.com ~all"]];
          if (name === "_dmarc.example.com") return [["v=DMARC1; p=none"]];
          if (name === "google._domainkey.example.com") return [["v=DKIM1; k=rsa; p=abc"]];
          return [];
        },
      })
    ).resolves.toMatchObject({
      status: "pass",
      checks: { mx: "pass", spf: "pass", dmarc: "pass", dkim: "pass" },
    });
  });

  test("returns warn on missing auth records and unknown on timeout", async () => {
    await expect(
      checkDomain("example.com", {
        resolveMx: async () => {
          throw new Error("ETIMEOUT");
        },
        resolveTxt: async () => [],
      })
    ).resolves.toMatchObject({
      status: "unknown",
      checks: { mx: "unknown", spf: "warn", dmarc: "warn", dkim: "warn" },
    });
  });

  test("bounds a resolver that never settles", async () => {
    const never = () => new Promise<never>(() => undefined);

    await expect(
      checkDomain("example.com", { resolveMx: never, resolveTxt: never }, { timeoutMs: 5 })
    ).resolves.toMatchObject({ status: "unknown" });
  });
});
