import { describe, expect, test, vi } from "vitest";

import { runSmoke } from "../../scripts/smoke";

describe("smoke script", () => {
  test("fails when health endpoint is unavailable", async () => {
    const result = await runSmoke({
      baseUrl: "http://localhost:3000",
      fetch: vi.fn(async () => {
        throw new Error("offline");
      }),
      env: {},
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain("health endpoint unavailable");
  });

  test("fails on degraded health unless allowed", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ status: "degraded", db: { status: "degraded" } })
    );

    await expect(
      runSmoke({ baseUrl: "http://localhost:3000", fetch, env: requiredEnv() })
    ).resolves.toMatchObject({ ok: false });
    await expect(
      runSmoke({
        baseUrl: "http://localhost:3000",
        fetch,
        env: requiredEnv(),
        allowDegraded: true,
      })
    ).resolves.toMatchObject({ ok: true });
  });

  test("validates required production env names", async () => {
    const result = await runSmoke({
      baseUrl: "http://localhost:3000",
      fetch: vi.fn(async () => Response.json({ status: "ok" })),
      env: {},
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        "missing env: BETTER_AUTH_SECRET",
        "missing env: CREDENTIAL_ACTIVE_KEY_ID",
        "missing env: CREDENTIAL_KEYS_JSON",
        "missing env: UNSUBSCRIBE_SECRET",
        "missing env: APP_DATABASE_URL",
        "missing env: AUTH_DATABASE_URL",
      ])
    );
  });

  test("WorkOS mode does not require Better Auth database credentials", async () => {
    await expect(
      runSmoke({
        baseUrl: "http://localhost:3000",
        fetch: vi.fn(async () => Response.json({ status: "ok" })),
        env: {
          AUTH_PROVIDER: "workos",
          CREDENTIAL_ACTIVE_KEY_ID: "current",
          CREDENTIAL_KEYS_JSON: JSON.stringify({ current: "0".repeat(64) }),
          UNSUBSCRIBE_SECRET: "unsubscribe",
          APP_DATABASE_URL: "postgres://samrian_app_runtime@localhost:5432/samrian",
        },
      })
    ).resolves.toMatchObject({ ok: true });
  });
});

function requiredEnv() {
  return {
    AUTH_PROVIDER: "better-auth",
    BETTER_AUTH_SECRET: "auth",
    CREDENTIAL_ACTIVE_KEY_ID: "current",
    CREDENTIAL_KEYS_JSON: JSON.stringify({ current: "0".repeat(64) }),
    UNSUBSCRIBE_SECRET: "unsubscribe",
    APP_DATABASE_URL: "postgres://samrian_app_runtime@localhost:5432/samrian",
    AUTH_DATABASE_URL: "postgres://samrian_auth_runtime@localhost:5432/samrian",
  };
}
