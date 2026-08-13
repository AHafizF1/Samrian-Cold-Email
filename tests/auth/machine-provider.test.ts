import { scopes } from "../../packages/contracts/src";
import {
  createBetterMachineCredential,
  createWorkosMachineCredential,
} from "../../src/server/auth/machine-provider";
import { describe, expect, it, vi } from "vitest";

describe("machine credential providers", () => {
  it("maps Better Auth organization key into canonical principal", async () => {
    const verifyApiKey = vi.fn().mockResolvedValue({
      valid: true,
      key: {
        id: "key_1",
        referenceId: "org_1",
        permissions: { automation: ["contacts.read", "campaigns.launch"] },
        expiresAt: null,
      },
    });
    const credential = createBetterMachineCredential({
      verifyApiKey,
    });

    await expect(credential.verify("sam_test")).resolves.toEqual({
      credentialId: "key_1",
      provider: "better-auth",
      orgId: "org_1",
      scopes: ["contacts:read", "campaigns:launch"],
    });
    expect(verifyApiKey).toHaveBeenCalledWith({
      body: { key: "sam_test", configId: "automation" },
    });
  });

  it("maps WorkOS organization key permissions without exposing key value", async () => {
    const credential = createWorkosMachineCredential({
      createValidation: vi.fn().mockResolvedValue({
        apiKey: {
          id: "key_2",
          owner: { type: "organization", id: "org_2" },
          permissions: ["contacts:read", "inbox:read"],
        },
      }),
    });

    await expect(credential.verify("sam_test")).resolves.toEqual({
      credentialId: "key_2",
      provider: "workos",
      orgId: "org_2",
      scopes: ["contacts:read", "inbox:read"],
    });
  });

  it("rejects WorkOS user-owned keys", async () => {
    const credential = createWorkosMachineCredential({
      createValidation: vi.fn().mockResolvedValue({
        apiKey: {
          id: "key_user",
          owner: { type: "user", id: "user_1", organizationId: "org_1" },
          permissions: ["contacts:read"],
        },
      }),
    });

    await expect(credential.verify("sam_user_test")).resolves.toBeNull();
  });

  it("filters unknown permissions rather than granting them", async () => {
    const credential = createWorkosMachineCredential({
      createValidation: vi.fn().mockResolvedValue({
        apiKey: {
          id: "key_3",
          owner: { type: "organization", id: "org_3" },
          permissions: ["contacts:read", "root:admin"],
        },
      }),
    });

    const principal = await credential.verify("sam_test");
    expect(principal?.scopes).toEqual(["contacts:read"]);
    expect(scopes).not.toContain("root:admin" as never);
  });

  it("creates Better Auth keys with canonical organization permissions", async () => {
    const createApiKey = vi.fn().mockResolvedValue({
      id: "key_1",
      key: "sam_secret",
      name: "CI",
      permissions: { automation: ["contacts.read"] },
      createdAt: new Date("2026-07-13T10:00:00.000Z"),
      expiresAt: null,
    });
    const credential = createBetterMachineCredential({
      verifyApiKey: vi.fn(),
      createApiKey,
      listApiKeys: vi.fn(),
      updateApiKey: vi.fn(),
    });

    await expect(
      credential.create({
        orgId: "org_1",
        userId: "user_1",
        name: "CI",
        scopes: ["contacts:read"],
      })
    ).resolves.toMatchObject({ id: "key_1", value: "sam_secret", scopes: ["contacts:read"] });
    expect(createApiKey).toHaveBeenCalledWith({
      body: {
        configId: "automation",
        name: "CI",
        organizationId: "org_1",
        userId: "user_1",
        permissions: { automation: ["contacts.read"] },
      },
    });
  });

  it("creates and revokes WorkOS organization keys through official methods", async () => {
    const createOrganizationApiKey = vi.fn().mockResolvedValue({
      id: "key_2",
      value: "sk_secret",
      name: "Agent",
      permissions: ["contacts:read"],
      createdAt: "2026-07-13T10:00:00.000Z",
      obfuscatedValue: "sk_...ret",
      lastUsedAt: null,
    });
    const deleteApiKey = vi.fn().mockResolvedValue(undefined);
    const credential = createWorkosMachineCredential({
      createValidation: vi.fn(),
      createOrganizationApiKey,
      listOrganizationApiKeys: vi.fn().mockResolvedValue({
        data: [
          {
            id: "key_2",
            name: "Agent",
            permissions: ["contacts:read"],
            createdAt: "2026-07-13T10:00:00.000Z",
            obfuscatedValue: "sk_...ret",
            lastUsedAt: null,
          },
        ],
      }),
      deleteApiKey,
    });

    await expect(
      credential.create({
        orgId: "org_2",
        userId: "user_2",
        name: "Agent",
        scopes: ["contacts:read"],
      })
    ).resolves.toMatchObject({ id: "key_2", value: "sk_secret" });
    await expect(credential.revoke({ orgId: "org_2", id: "key_2" })).resolves.toEqual({
      revoked: true,
      reversible: false,
      provider: "workos",
    });
    expect(createOrganizationApiKey).toHaveBeenCalledWith({
      organizationId: "org_2",
      name: "Agent",
      permissions: ["contacts:read"],
    });
    expect(deleteApiKey).toHaveBeenCalledWith("key_2");
  });

  it("reports Better Auth disable as reversible revocation", async () => {
    const updateApiKey = vi.fn();
    const credential = createBetterMachineCredential({ verifyApiKey: vi.fn(), updateApiKey });

    await expect(credential.revoke({ orgId: "org_1", id: "key_1" })).resolves.toEqual({
      revoked: true,
      reversible: true,
      provider: "better-auth",
    });
  });

  it("lists metadata without returning WorkOS key plaintext", async () => {
    const credential = createWorkosMachineCredential({
      createValidation: vi.fn(),
      createOrganizationApiKey: vi.fn(),
      deleteApiKey: vi.fn(),
      listOrganizationApiKeys: vi.fn().mockResolvedValue({
        data: [
          {
            id: "key_2",
            name: "Agent",
            permissions: ["contacts:read"],
            createdAt: "2026-07-13T10:00:00.000Z",
            obfuscatedValue: "sk_...ret",
            lastUsedAt: null,
          },
        ],
      }),
    });

    const result = await credential.list({ orgId: "org_2" });
    expect(result).toEqual([
      {
        id: "key_2",
        name: "Agent",
        scopes: ["contacts:read"],
        createdAt: "2026-07-13T10:00:00.000Z",
        obfuscatedValue: "sk_...ret",
      },
    ]);
    expect(result[0]).not.toHaveProperty("value");
  });
});
