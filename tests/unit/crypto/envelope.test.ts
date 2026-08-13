import { describe, expect, it } from "vitest";
import { createCipheriv, randomBytes } from "node:crypto";

import {
  createCredentialCrypto,
  type CredentialContext,
} from "../../../src/server/crypto/envelope";

const context: CredentialContext = {
  orgId: "org_1",
  mailboxId: "mailbox_1",
  provider: "google",
  purpose: "refresh-token",
};

describe("credential envelope", () => {
  it("encrypts with active key and context-bound AAD", () => {
    const crypto = createCredentialCrypto({
      activeKeyId: "key_2",
      keys: { key_1: Buffer.alloc(32, 1), key_2: Buffer.alloc(32, 2) },
    });

    const encrypted = crypto.encrypt("refresh-secret", context);
    const parsed = JSON.parse(encrypted);

    expect(parsed).toMatchObject({ v: 2, kid: "key_2", alg: "A256GCM" });
    expect(encrypted).not.toContain("refresh-secret");
    expect(crypto.decrypt(encrypted, context)).toBe("refresh-secret");
  });

  it.each([
    { ...context, orgId: "org_2" },
    { ...context, mailboxId: "mailbox_2" },
    { ...context, provider: "microsoft" as const },
    { ...context, purpose: "access-token" as const },
  ])("rejects ciphertext moved to another context", (wrongContext) => {
    const crypto = createCredentialCrypto({
      activeKeyId: "key_1",
      keys: { key_1: Buffer.alloc(32, 1) },
    });
    const encrypted = crypto.encrypt("refresh-secret", context);

    expect(() => crypto.decrypt(encrypted, wrongContext)).toThrow("Credential decryption failed");
  });

  it("decrypts previous keys but encrypts only with active key", () => {
    const oldCrypto = createCredentialCrypto({
      activeKeyId: "key_1",
      keys: { key_1: Buffer.alloc(32, 1) },
    });
    const encrypted = oldCrypto.encrypt("secret", context);
    const rotated = createCredentialCrypto({
      activeKeyId: "key_2",
      keys: { key_1: Buffer.alloc(32, 1), key_2: Buffer.alloc(32, 2) },
    });

    expect(rotated.decrypt(encrypted, context)).toBe("secret");
    expect(JSON.parse(rotated.encrypt("new-secret", context)).kid).toBe("key_2");
  });

  it("decrypts legacy blobs only when migration key is configured", () => {
    const key = Buffer.alloc(32, 3);
    const encrypted = legacyEncrypt("legacy-secret", key);
    const crypto = createCredentialCrypto({
      activeKeyId: "key_2",
      keys: { key_2: Buffer.alloc(32, 2) },
      legacyKey: key,
    });

    expect(crypto.decrypt(encrypted, context)).toBe("legacy-secret");
    expect(() =>
      createCredentialCrypto({
        activeKeyId: "key_2",
        keys: { key_2: Buffer.alloc(32, 2) },
      }).decrypt(encrypted, context)
    ).toThrow("Legacy credential key is not configured");
  });

  it.each([
    "{}",
    '{"v":99,"kid":"key_1","alg":"A256GCM","iv":"x","ct":"x","tag":"x"}',
    '{"v":2,"kid":"missing","alg":"A256GCM","iv":"x","ct":"x","tag":"x"}',
  ])("rejects malformed or unsupported envelope", (value) => {
    const crypto = createCredentialCrypto({
      activeKeyId: "key_1",
      keys: { key_1: Buffer.alloc(32, 1) },
    });

    expect(() => crypto.decrypt(value, context)).toThrow();
  });
});

function legacyEncrypt(plaintext: string, key: Buffer) {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return JSON.stringify({
    c: Buffer.concat([ciphertext, cipher.getAuthTag()]).toString("hex"),
    iv: iv.toString("hex"),
  });
}
