import { scopes, type Scope } from "@samrian/contracts";

import type { AutomationPrincipal, MachineCredential } from "./machine";

type BetterKey = {
  id: string;
  referenceId: string;
  permissions: Record<string, string[]> | null;
  expiresAt: Date | null;
  name?: string | null;
  createdAt?: Date;
  start?: string | null;
};

type BetterApi = {
  verifyApiKey(input: { body: { key: string; configId: string } }): Promise<{
    valid: boolean;
    key: BetterKey | null;
  }>;
  createApiKey?(input: {
    body: {
      configId: string;
      name: string;
      organizationId: string;
      userId: string;
      permissions: Record<string, string[]>;
    };
  }): Promise<BetterKey & { key: string; createdAt: Date }>;
  listApiKeys?(input: { query: { configId: string; organizationId: string } }): Promise<{
    apiKeys: BetterKey[];
  }>;
  updateApiKey?(input: {
    body: { configId: string; keyId: string; organizationId: string; enabled: boolean };
  }): Promise<unknown>;
};

type WorkosApi = {
  createValidation(input: { value: string }): Promise<{
    apiKey: {
      id: string;
      owner:
        { type: "organization"; id: string } | { type: "user"; id: string; organizationId: string };
      permissions: string[];
    } | null;
  }>;
  createOrganizationApiKey?(input: {
    organizationId: string;
    name: string;
    permissions: string[];
  }): Promise<WorkosKey & { value: string }>;
  listOrganizationApiKeys?(input: { organizationId: string }): Promise<{ data: WorkosKey[] }>;
  deleteApiKey?(id: string): Promise<void>;
};

type WorkosKey = {
  id: string;
  name: string;
  permissions: string[];
  createdAt: string;
  obfuscatedValue: string;
  lastUsedAt: string | null;
};

export function createBetterMachineCredential(api: BetterApi): MachineCredential {
  return {
    async create(input) {
      if (!api.createApiKey) throw new Error("Credential management unavailable");
      const key = await api.createApiKey({
        body: {
          configId: "automation",
          name: input.name,
          organizationId: input.orgId,
          userId: input.userId,
          permissions: toBetterPermissions(input.scopes),
        },
      });
      return {
        id: key.id,
        name: key.name ?? input.name,
        value: key.key,
        scopes: fromBetterPermissions(key.permissions),
        createdAt: key.createdAt.toISOString(),
        ...(key.start ? { obfuscatedValue: key.start } : {}),
        ...(key.expiresAt ? { expiresAt: key.expiresAt.toISOString() } : {}),
      };
    },
    async list(input) {
      if (!api.listApiKeys) throw new Error("Credential management unavailable");
      const result = await api.listApiKeys({
        query: { configId: "automation", organizationId: input.orgId },
      });
      return result.apiKeys.map((key) => ({
        id: key.id,
        name: key.name ?? "API key",
        scopes: fromBetterPermissions(key.permissions),
        createdAt: key.createdAt?.toISOString() ?? "",
        ...(key.start ? { obfuscatedValue: key.start } : {}),
        ...(key.expiresAt ? { expiresAt: key.expiresAt.toISOString() } : {}),
      }));
    },
    async verify(value) {
      const result = await api.verifyApiKey({
        body: { key: value, configId: "automation" },
      });
      if (!result.valid || !result.key) return null;

      return {
        credentialId: result.key.id,
        provider: "better-auth",
        orgId: result.key.referenceId,
        scopes: fromBetterPermissions(result.key.permissions),
        ...(result.key.expiresAt ? { expiresAt: result.key.expiresAt.toISOString() } : {}),
      };
    },
    async revoke(input) {
      if (!api.updateApiKey) throw new Error("Credential management unavailable");
      await api.updateApiKey({
        body: {
          configId: "automation",
          keyId: input.id,
          organizationId: input.orgId,
          enabled: false,
        },
      });
      return { revoked: true, reversible: true, provider: "better-auth" };
    },
  };
}

export function createWorkosMachineCredential(api: WorkosApi): MachineCredential {
  return {
    async create(input) {
      if (!api.createOrganizationApiKey) throw new Error("Credential management unavailable");
      const key = await api.createOrganizationApiKey({
        organizationId: input.orgId,
        name: input.name,
        permissions: input.scopes,
      });
      return { ...toWorkosMetadata(key), value: key.value };
    },
    async list(input) {
      if (!api.listOrganizationApiKeys) throw new Error("Credential management unavailable");
      const result = await api.listOrganizationApiKeys({ organizationId: input.orgId });
      return result.data.map(toWorkosMetadata);
    },
    async verify(value) {
      const result = await api.createValidation({ value });
      if (!result.apiKey || result.apiKey.owner.type !== "organization") return null;

      return {
        credentialId: result.apiKey.id,
        provider: "workos",
        orgId: result.apiKey.owner.id,
        scopes: toScopes(result.apiKey.permissions),
      };
    },
    async revoke(input) {
      if (!api.listOrganizationApiKeys || !api.deleteApiKey) {
        throw new Error("Credential management unavailable");
      }
      const result = await api.listOrganizationApiKeys({ organizationId: input.orgId });
      if (!result.data.some((key) => key.id === input.id)) throw new Error("Credential not found");
      await api.deleteApiKey(input.id);
      return { revoked: true, reversible: false, provider: "workos" };
    },
  };
}

export async function getMachineCredential(headers?: Headers): Promise<MachineCredential> {
  const { getAuthProviderName } = await import("./provider");

  if (getAuthProviderName() === "workos") {
    const { getWorkOS } = await import("@workos-inc/authkit-nextjs");
    return createWorkosMachineCredential(getWorkOS().apiKeys);
  }

  const [{ getAuthDb }, { assertDatabaseRole }] = await Promise.all([
    import("../db/db"),
    import("../db/tenant"),
  ]);
  await assertDatabaseRole(getAuthDb(), "auth");

  const { createBetterAuth } = await import("./better");
  const auth = createBetterAuth();
  return createBetterMachineCredential({
    async verifyApiKey(input) {
      // Better Auth's plugin endpoint type is erased by the factory return type.
      // Keep the boundary cast here, not in routes or domain code.
      return (await auth.api.verifyApiKey(input)) as unknown as {
        valid: boolean;
        key: BetterKey | null;
      };
    },
    // Better Auth intentionally permits custom permissions only on a pure
    // server call. Session route already authorized actor and supplies userId.
    createApiKey: (input) => auth.api.createApiKey(input),
    listApiKeys: (input) => auth.api.listApiKeys({ ...input, headers }),
    updateApiKey: (input) => auth.api.updateApiKey({ ...input, headers }),
  });
}

function fromBetterPermissions(permissions: Record<string, string[]> | null): Scope[] {
  if (!permissions) return [];

  return toScopes(
    Object.entries(permissions).flatMap(([resource, actions]) =>
      resource === "automation"
        ? actions.map((action) => action.replace(".", ":"))
        : actions.map((action) => `${resource}:${action}`)
    )
  );
}

function toScopes(values: readonly string[]): Scope[] {
  return values.filter((value): value is Scope => (scopes as readonly string[]).includes(value));
}

function toBetterPermissions(values: readonly Scope[]): Record<string, string[]> {
  return { automation: values.map((value) => value.replace(":", ".")) };
}

function toWorkosMetadata(key: WorkosKey) {
  return {
    id: key.id,
    name: key.name,
    scopes: toScopes(key.permissions),
    createdAt: key.createdAt,
    obfuscatedValue: key.obfuscatedValue,
  };
}
