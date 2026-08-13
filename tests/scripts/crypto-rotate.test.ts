import { describe, expect, it, vi } from "vitest";

import { createCredentialCrypto } from "../../src/server/crypto";
import { runCredentialRotation } from "../../scripts/crypto/rotate";

describe("credential rotation script", () => {
  it("dry-runs without writing and returns a resume cursor", async () => {
    const oldCrypto = createCredentialCrypto({
      activeKeyId: "old",
      keys: { old: Buffer.alloc(32, 1) },
    });
    const value = oldCrypto.encrypt("secret", {
      orgId: "org_1",
      mailboxId: "mailbox_1",
      provider: "smtp",
      purpose: "password",
    });
    const update = vi.fn();

    const result = await runCredentialRotation([], {
      activeKeyId: "new",
      crypto: createCredentialCrypto({
        activeKeyId: "new",
        keys: { old: Buffer.alloc(32, 1), new: Buffer.alloc(32, 2) },
      }),
      list: async () => [
        {
          id: "mailbox_1",
          orgId: "org_1",
          provider: "smtp",
          encryptedPassword: value,
        },
      ],
      update,
    });

    expect(result).toEqual({
      apply: false,
      failed: 0,
      nextCursor: "mailbox_1",
      rotated: 0,
      scanned: 1,
      stale: 1,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("applies rotation without exposing plaintext in the patch", async () => {
    const oldCrypto = createCredentialCrypto({
      activeKeyId: "old",
      keys: { old: Buffer.alloc(32, 1) },
    });
    const value = oldCrypto.encrypt("secret", {
      orgId: "org_1",
      mailboxId: "mailbox_1",
      provider: "google",
      purpose: "refresh-token",
    });
    const update = vi.fn();

    const result = await runCredentialRotation(["--apply"], {
      activeKeyId: "new",
      crypto: createCredentialCrypto({
        activeKeyId: "new",
        keys: { old: Buffer.alloc(32, 1), new: Buffer.alloc(32, 2) },
      }),
      list: async () => [
        {
          id: "mailbox_1",
          orgId: "org_1",
          provider: "google",
          encryptedRefreshToken: value,
        },
      ],
      update,
    });

    expect(result.rotated).toBe(1);
    expect(JSON.stringify(update.mock.calls)).not.toContain("secret");
    expect(update).toHaveBeenCalledOnce();
  });
});
