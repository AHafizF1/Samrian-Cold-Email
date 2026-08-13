import { afterEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("auth provider selection", () => {
  test("defaults to Better Auth", async () => {
    delete process.env.AUTH_PROVIDER;

    const { getAuthProviderName } = await import("../../src/server/auth/provider");

    expect(getAuthProviderName()).toBe("better-auth");
  }, 15_000);

  test("rejects unsupported auth provider", async () => {
    process.env.AUTH_PROVIDER = "custom";

    const { getAuthProvider } = await import("../../src/server/auth/provider");

    expect(() => getAuthProvider()).toThrow("Unsupported AUTH_PROVIDER");
  });

  test("Better Auth mode does not require WorkOS env", async () => {
    process.env.AUTH_PROVIDER = "better-auth";
    delete process.env.WORKOS_API_KEY;
    delete process.env.WORKOS_CLIENT_ID;
    delete process.env.WORKOS_COOKIE_PASSWORD;
    delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;

    const { getAuthProvider } = await import("../../src/server/auth/provider");

    expect(() => getAuthProvider()).not.toThrow();
  });

  test("WorkOS mode requires WorkOS env", async () => {
    process.env.AUTH_PROVIDER = "workos";
    delete process.env.WORKOS_API_KEY;

    const { getAuthProvider } = await import("../../src/server/auth/provider");

    expect(() => getAuthProvider()).toThrow("Missing WorkOS auth config");
  });
});
