import { createApiRoute } from "../../src/server/api/route";
import type { IdempotencyStore } from "../../src/server/api/idempotency";
import type { AutomationPrincipal, MachineCredential } from "../../src/server/auth/machine";
import type { Logger } from "../../src/server/observability/logs";
import type { LimitGuard } from "../../src/server/modules/limits";
import { describe, expect, it, vi } from "vitest";

const principal: AutomationPrincipal = {
  credentialId: "key_1",
  provider: "better-auth" as const,
  orgId: "org_1",
  userId: "user_1",
  scopes: ["identity:read"],
};

const tenant = async <T>(_context: unknown, operation: (db: never) => Promise<T>) =>
  operation(undefined as never);

function credentials(value: AutomationPrincipal = principal): MachineCredential {
  return {
    create: vi.fn(),
    list: vi.fn(),
    verify: vi.fn().mockResolvedValue(value),
    revoke: vi.fn(),
  };
}

describe("v1 route wrapper", () => {
  it("rejects a missing bearer credential with stable response", async () => {
    const route = createApiRoute({
      operation: "identity.me",
      credentials: credentials(),
      tenant,
      handler: async () => ({ data: { credentialId: "key_1", orgId: "org_1", scopes: [] } }),
    });

    const response = await route(new Request("http://localhost/api/v1/me"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("enforces registered scopes and wraps success with request id", async () => {
    const route = createApiRoute({
      operation: "identity.me",
      credentials: credentials(),
      tenant,
      handler: async ({ principal: actor }) => ({
        data: { credentialId: actor.credentialId, orgId: actor.orgId, scopes: actor.scopes },
      }),
    });

    const response = await route(
      new Request("http://localhost/api/v1/me", {
        headers: {
          authorization: "Bearer sam_test",
          "x-request-id": "req_test",
          "x-correlation-id": "corr_test",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("req_test");
    expect(response.headers.get("x-correlation-id")).toBe("corr_test");
    await expect(response.json()).resolves.toEqual({
      data: { credentialId: "key_1", orgId: "org_1", scopes: ["identity:read"] },
      meta: { requestId: "req_test" },
    });
  });

  it("rejects a credential missing operation scope", async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() } as unknown as Logger;
    const route = createApiRoute({
      operation: "identity.me",
      credentials: credentials({ ...principal, scopes: [] }),
      tenant,
      logger,
      handler: async () => ({ data: { credentialId: "key_1", orgId: "org_1", scopes: [] } }),
    });

    const response = await route(
      new Request("http://localhost/api/v1/me", {
        headers: { authorization: "Bearer sam_test" },
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "MISSING_SCOPE" } });
    expect(warn).toHaveBeenCalledWith(
      "credential.denied",
      expect.objectContaining({ credentialId: "key_1", operation: "identity.me" })
    );
  });

  it("returns stable rate-limit response and retry headers", async () => {
    const limits: LimitGuard = {
      check: vi.fn().mockResolvedValue({
        allowed: false,
        policyId: "credential.api.read",
        limit: 120,
        remaining: 0,
        retryAfterMs: 2_000,
        resetAt: 5_000,
      }),
      checkPublic: vi.fn(),
      checkSubject: vi.fn().mockResolvedValue({
        allowed: true,
        policyId: "public.token",
        limit: 20,
        remaining: 20,
        retryAfterMs: 0,
        resetAt: 5_000,
      }),
    };
    const route = createApiRoute({
      operation: "identity.me",
      credentials: credentials(),
      limits,
      tenant,
      handler: async () => ({ data: { credentialId: "key_1", orgId: "org_1", scopes: [] } }),
    });

    const response = await route(
      new Request("http://localhost/api/v1/me", {
        headers: { authorization: "Bearer sam_test", "x-request-id": "req_limit" },
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("2");
    expect(response.headers.get("ratelimit-policy")).toBe("credential.api.read");
    expect(response.headers.get("ratelimit-remaining")).toBe("0");
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "RATE_LIMITED",
        requestId: "req_limit",
        details: { policyId: "credential.api.read", retryAfter: 2 },
      },
    });
  });

  it("audits credential use without bearer value", async () => {
    const info = vi.fn();
    const logger = { info, error: vi.fn() } as unknown as Logger;
    const route = createApiRoute({
      operation: "identity.me",
      credentials: credentials(),
      tenant,
      logger,
      handler: async () => ({ data: { credentialId: "key_1", orgId: "org_1", scopes: [] } }),
    });

    await route(
      new Request("http://localhost/api/v1/me", {
        headers: { authorization: "Bearer sam_secret" },
      })
    );

    expect(info).toHaveBeenCalledWith(
      "credential.used",
      expect.objectContaining({ credentialId: "key_1", operation: "identity.me" })
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("sam_secret");
  });

  it("rejects handler output outside operation response contract", async () => {
    const route = createApiRoute({
      operation: "identity.me",
      credentials: credentials(),
      tenant,
      handler: async () => ({ data: { wrong: true } }),
    });

    const response = await route(
      new Request("http://localhost/api/v1/me", {
        headers: { authorization: "Bearer sam_test" },
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  it("requires idempotency key for protected writes", async () => {
    const route = createApiRoute({
      operation: "contacts.import",
      credentials: credentials({ ...principal, scopes: ["contacts:write"] }),
      tenant,
      idempotency: () => memoryStore(),
      handler: async () => ({ data: importResult }),
    });

    const response = await route(
      new Request("http://localhost/api/v1/contacts/import", {
        method: "POST",
        headers: { authorization: "Bearer sam_test", "content-type": "application/json" },
        body: JSON.stringify({ contacts: [{ email: "ada@example.com" }] }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "IDEMPOTENCY_REQUIRED" },
    });
  });

  it("rejects oversized API bodies before credential verification", async () => {
    const machine = credentials({ ...principal, scopes: ["contacts:write"] });
    const route = createApiRoute({
      operation: "contacts.import",
      credentials: machine,
      tenant,
      bodyLimitBytes: 8,
      idempotency: () => memoryStore(),
      handler: async () => ({ data: importResult }),
    });

    const response = await route(
      new Request("http://localhost/api/v1/contacts/import", {
        method: "POST",
        headers: {
          authorization: "Bearer sam_test",
          "content-type": "application/json",
          "idempotency-key": "import_large",
        },
        body: JSON.stringify({ contacts: [{ email: "ada@example.com" }] }),
      })
    );

    expect(response.status).toBe(413);
    expect(machine.verify).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
  });

  it("replays completed idempotent write without rerunning handler", async () => {
    const store = memoryStore();
    const handler = vi.fn().mockResolvedValue({ data: importResult });
    const route = createApiRoute({
      operation: "contacts.import",
      credentials: credentials({ ...principal, scopes: ["contacts:write"] }),
      tenant,
      idempotency: () => store,
      handler,
    });
    const request = () =>
      new Request("http://localhost/api/v1/contacts/import", {
        method: "POST",
        headers: {
          authorization: "Bearer sam_test",
          "content-type": "application/json",
          "idempotency-key": "import_1",
        },
        body: JSON.stringify({ contacts: [{ email: "ada@example.com" }] }),
      });

    expect((await route(request())).status).toBe(200);
    expect((await route(request())).status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});

const importResult = {
  created: 1,
  updated: 0,
  skipped: 0,
  duplicateRows: 0,
  invalidRows: 0,
  blockedRows: 0,
  hardBouncedRows: 0,
  unverifiableRows: 0,
  errors: [],
  ids: ["contact_1"],
};

function memoryStore(): IdempotencyStore {
  const records = new Map<string, { fingerprint: string; result?: unknown }>();
  return {
    get: async (key) => records.get(key) ?? null,
    reserve: async (key, fingerprint) => {
      if (records.has(key)) return false;
      records.set(key, { fingerprint });
      return true;
    },
    complete: async (key, result) => {
      records.set(key, { ...records.get(key)!, result });
    },
  };
}
