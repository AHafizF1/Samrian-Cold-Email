import { createApiKey, revokeApiKey } from "../../../src/server/modules/api-keys";
import type { Logger } from "../../../src/server/observability/logs";
import type { MachineCredential } from "../../../src/server/auth/machine";
import { describe, expect, it, vi } from "vitest";

function credentials(): MachineCredential {
  return {
    create: vi.fn().mockResolvedValue({
      id: "key_1",
      name: "CI",
      value: "sam_secret",
      scopes: ["contacts:read"],
      createdAt: "2026-07-13T10:00:00.000Z",
    }),
    list: vi.fn(),
    verify: vi.fn(),
    revoke: vi.fn().mockResolvedValue({
      revoked: true,
      reversible: true,
      provider: "better-auth",
    }),
  };
}

describe("API key management", () => {
  it("forces organization from authenticated owner context", async () => {
    const provider = credentials();

    await createApiKey(
      { name: "CI", scopes: ["contacts:read"] },
      { actor: { userId: "user_1", orgId: "org_1", role: "owner" }, provider }
    );

    expect(provider.create).toHaveBeenCalledWith({
      orgId: "org_1",
      userId: "user_1",
      name: "CI",
      scopes: ["contacts:read"],
    });
  });

  it("audits create and revoke without credential plaintext", async () => {
    const provider = credentials();
    const info = vi.fn();
    const logger = { info } as unknown as Logger;
    const deps = {
      actor: { userId: "user_1", orgId: "org_1", role: "owner" as const },
      provider,
      logger,
    };

    await createApiKey({ name: "CI", scopes: ["contacts:read"] }, deps);
    await revokeApiKey("key_1", deps);

    expect(info).toHaveBeenCalledWith(
      "credential.created",
      expect.objectContaining({ orgId: "org_1", credentialId: "key_1" })
    );
    expect(info).toHaveBeenCalledWith(
      "credential.revoked",
      expect.objectContaining({ orgId: "org_1", credentialId: "key_1" })
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("sam_secret");
  });
});
