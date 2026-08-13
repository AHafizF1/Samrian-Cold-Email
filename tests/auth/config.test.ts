import { describe, expect, test } from "vitest";

describe("auth config", () => {
  test("enables Better Auth Google login when both credentials exist", async () => {
    const { getGoogleAuthConfig } = await import("../../src/server/auth/config");

    expect(
      getGoogleAuthConfig({
        AUTH_PROVIDER: "better-auth",
        GOOGLE_AUTH_CLIENT_ID: "google-client-id",
        GOOGLE_AUTH_CLIENT_SECRET: "google-client-secret",
      })
    ).toEqual({
      enabled: true,
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
    });
  });

  test.each([
    { GOOGLE_AUTH_CLIENT_ID: "google-client-id" },
    { GOOGLE_AUTH_CLIENT_SECRET: "google-client-secret" },
    {},
  ])("disables Better Auth Google login when credentials are incomplete", async (env) => {
    const { getGoogleAuthConfig } = await import("../../src/server/auth/config");
    const config = getGoogleAuthConfig({ AUTH_PROVIDER: "better-auth", ...env });

    expect(config.enabled).toBe(false);
  });

  test("WorkOS mode does not require Better Auth Google credentials", async () => {
    const { getGoogleAuthConfig } = await import("../../src/server/auth/config");

    expect(getGoogleAuthConfig({ AUTH_PROVIDER: "workos" })).toEqual({ enabled: false });
  });

  test("WorkOS config errors expose missing names but never secret values", async () => {
    const { requireWorkosConfig } = await import("../../src/server/auth/config");
    const secret = "must-not-leak";

    expect(() => requireWorkosConfig({ AUTH_PROVIDER: "workos", WORKOS_API_KEY: secret })).toThrow(
      "WORKOS_CLIENT_ID"
    );

    try {
      requireWorkosConfig({ AUTH_PROVIDER: "workos", WORKOS_API_KEY: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });

  test("WorkOS config requires AuthKit redirect env", async () => {
    const { requireWorkosConfig } = await import("../../src/server/auth/config");

    expect(() =>
      requireWorkosConfig({
        AUTH_PROVIDER: "workos",
        WORKOS_API_KEY: "key",
        WORKOS_CLIENT_ID: "client",
        WORKOS_COOKIE_PASSWORD: "cookie-password",
        WORKOS_REDIRECT_URI: "http://wrong-name.example/callback",
      })
    ).toThrow("NEXT_PUBLIC_WORKOS_REDIRECT_URI");
  });
});
