import { describe, expect, it } from "vitest";

import { getMcpConfig } from "../../../packages/mcp/src/config";

describe("MCP config", () => {
  it("defaults to read-only", () => {
    expect(getMcpConfig({ SAMRIAN_URL: "https://app.test", SAMRIAN_TOKEN: "secret" })).toEqual({
      mode: "read-only",
      token: "secret",
      url: "https://app.test",
    });
  });

  it("accepts operator mode", () => {
    expect(
      getMcpConfig({
        MCP_MODE: "operator",
        SAMRIAN_URL: "https://app.test/",
        SAMRIAN_TOKEN: "secret",
      }).mode
    ).toBe("operator");
  });

  it("reports missing names without secret values", () => {
    expect(() => getMcpConfig({ SAMRIAN_TOKEN: "do-not-print" })).toThrow("SAMRIAN_URL");
    expect(() => getMcpConfig({ SAMRIAN_TOKEN: "do-not-print" })).not.toThrow("do-not-print");
  });

  it("rejects invalid modes", () => {
    expect(() =>
      getMcpConfig({ SAMRIAN_URL: "https://app.test", SAMRIAN_TOKEN: "secret", MCP_MODE: "admin" })
    ).toThrow("MCP_MODE");
  });

  it("rejects insecure remote URL before startup", () => {
    expect(() =>
      getMcpConfig({
        SAMRIAN_URL: "http://app.samrian.test",
        SAMRIAN_TOKEN: "do-not-print",
      })
    ).toThrow("SAMRIAN_URL");
  });
});
