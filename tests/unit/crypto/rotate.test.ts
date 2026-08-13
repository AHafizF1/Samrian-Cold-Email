import { describe, expect, it } from "vitest";

import { createCredentialCrypto, type CredentialContext } from "../../../src/server/crypto";
import { rotateCredential } from "../../../src/server/crypto/rotate";

const context: CredentialContext = {
  orgId: "org_1",
  mailboxId: "mailbox_1",
  provider: "smtp",
  purpose: "password",
};

describe("credential rotation", () => {
  it("skips credentials already using the active key", () => {
    const crypto = createCredentialCrypto({
      activeKeyId: "current",
      keys: { current: Buffer.alloc(32, 1) },
    });
    const value = crypto.encrypt("secret", context);

    expect(rotateCredential(value, context, "current", crypto)).toEqual({
      changed: false,
      value,
    });
  });

  it("re-encrypts previous-key credentials without exposing plaintext", () => {
    const previous = createCredentialCrypto({
      activeKeyId: "previous",
      keys: { previous: Buffer.alloc(32, 1) },
    });
    const current = createCredentialCrypto({
      activeKeyId: "current",
      keys: {
        previous: Buffer.alloc(32, 1),
        current: Buffer.alloc(32, 2),
      },
    });
    const value = previous.encrypt("secret", context);

    const result = rotateCredential(value, context, "current", current);

    expect(result.changed).toBe(true);
    expect(result.value).not.toContain("secret");
    expect(current.decrypt(result.value, context)).toBe("secret");
    expect(JSON.parse(result.value).kid).toBe("current");
  });
});
