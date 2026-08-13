import { describe, expect, test, vi } from "vitest";

import { HttpEmailVerifier } from "../../../src/server/verify/email";

describe("HTTP email verifier", () => {
  test("uses a bounded request signal", async () => {
    const fetch = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json({ status: "valid" });
    });
    const verifier = new HttpEmailVerifier(
      { url: "https://verify.example.com", provider: "test" },
      fetch
    );

    await expect(verifier.verify("ada@example.com")).resolves.toMatchObject({
      status: "valid",
    });
  });

  test("maps timeout and network failures to unverifiable", async () => {
    const verifier = new HttpEmailVerifier(
      { url: "https://verify.example.com", provider: "test" },
      vi.fn(async () => {
        throw new DOMException("Timed out", "TimeoutError");
      })
    );

    await expect(verifier.verify("ada@example.com")).resolves.toMatchObject({
      status: "unverifiable",
      reason: "provider-unavailable",
    });
  });
});
