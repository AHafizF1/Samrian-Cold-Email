import {
  extractBearerCredential,
  hasScopes,
  type AutomationPrincipal,
} from "../../src/server/auth/machine";
import { describe, expect, it } from "vitest";

const principal: AutomationPrincipal = {
  credentialId: "key_1",
  provider: "better-auth",
  orgId: "org_1",
  scopes: ["contacts:read", "campaigns:launch"],
};

describe("machine credentials", () => {
  it("extracts one bearer credential", () => {
    expect(extractBearerCredential(new Headers({ authorization: "Bearer sam_test" }))).toBe(
      "sam_test"
    );
  });

  it("rejects malformed and multiple credentials", () => {
    expect(() => extractBearerCredential(new Headers({ authorization: "Basic abc" }))).toThrow();
    expect(() =>
      extractBearerCredential(
        new Headers([
          ["authorization", "Bearer one"],
          ["authorization", "Bearer two"],
        ])
      )
    ).toThrow();
  });

  it("requires all operation scopes", () => {
    expect(hasScopes(principal, ["contacts:read", "campaigns:launch"])).toBe(true);
    expect(hasScopes(principal, ["inbox:reply"])).toBe(false);
  });
});
