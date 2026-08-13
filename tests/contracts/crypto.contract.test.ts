import { describe, expect, test } from "vitest";

import type { SecretCrypto } from "../../src/server/ports";
import { FakeSecretCrypto } from "../fakes/fake-crypto";

describe("SecretCrypto contract", () => {
  test("encrypts and decrypts plaintext without exposing it in the blob", async () => {
    const crypto: SecretCrypto = new FakeSecretCrypto("test-key");

    const blob = await crypto.encryptString("secret-password");

    expect(JSON.stringify(blob)).not.toContain("secret-password");
    await expect(crypto.decryptString(blob)).resolves.toBe("secret-password");
  });

  test("rejects malformed and unsupported blobs", async () => {
    const crypto: SecretCrypto = new FakeSecretCrypto("test-key");

    await expect(crypto.decryptString({ version: 99, data: "bad" })).rejects.toThrow(
      "Unsupported encrypted blob version"
    );
    await expect(crypto.decryptString({ version: 1, data: "not-base64" })).rejects.toThrow(
      "Malformed encrypted blob"
    );
  });
});
