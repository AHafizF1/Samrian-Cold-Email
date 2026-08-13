import { describe, expect, it } from "vitest";

import { getCredentialKeys } from "../../../src/server/crypto/keys";

describe("credential key config", () => {
  it("loads active and decrypt-only keys", () => {
    const config = getCredentialKeys({
      CREDENTIAL_ACTIVE_KEY_ID: "current",
      CREDENTIAL_KEYS_JSON: JSON.stringify({
        current: "01".repeat(32),
        previous: "02".repeat(32),
      }),
    });

    expect(config.activeKeyId).toBe("current");
    expect(Object.keys(config.keys)).toEqual(["current", "previous"]);
    expect(config.keys.current?.length).toBe(32);
  });

  it("supports the legacy master key during migration", () => {
    const config = getCredentialKeys({ MASTER_ENCRYPTION_KEY: "03".repeat(32) });

    expect(config.activeKeyId).toBe("legacy-master");
    expect(config.keys["legacy-master"]).toEqual(Buffer.alloc(32, 3));
    expect(config.legacyKey).toEqual(Buffer.alloc(32, 3));
  });

  it("reports env names without secret values", () => {
    const secret = "do-not-print";

    expect(() =>
      getCredentialKeys({
        CREDENTIAL_ACTIVE_KEY_ID: "missing",
        CREDENTIAL_KEYS_JSON: JSON.stringify({ other: secret }),
      })
    ).toThrow("CREDENTIAL_KEYS_JSON");
    expect(() =>
      getCredentialKeys({
        CREDENTIAL_ACTIVE_KEY_ID: "missing",
        CREDENTIAL_KEYS_JSON: JSON.stringify({ other: secret }),
      })
    ).not.toThrow(secret);
  });
});
