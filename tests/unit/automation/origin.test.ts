import { describe, expect, it } from "vitest";

import { validateBaseUrl } from "../../../packages/sdk/src/origin";

describe("automation origin policy", () => {
  it.each([
    "https://app.samrian.test",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("accepts secure or loopback origin %s", (value) => {
    expect(validateBaseUrl(value)).toBe(value);
  });

  it.each([
    "http://app.samrian.test",
    "https://user:pass@app.samrian.test",
    "https://app.samrian.test/path",
    "https://app.samrian.test?token=secret",
    "https://app.samrian.test/#fragment",
    "ftp://app.samrian.test",
  ])("rejects unsafe origin %s", (value) => {
    expect(() => validateBaseUrl(value)).toThrow("SAMRIAN_URL");
  });
});
