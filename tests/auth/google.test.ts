import { afterEach, describe, expect, test, vi } from "vitest";

const signInSocial = vi.fn(async () => ({ data: { redirect: true }, error: null }));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn(), social: signInSocial },
    signUp: { email: vi.fn() },
    organization: { create: vi.fn(), list: vi.fn(), setActive: vi.fn() },
    signOut: vi.fn(),
  },
}));

const originalProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER;

afterEach(() => {
  process.env.NEXT_PUBLIC_AUTH_PROVIDER = originalProvider;
  signInSocial.mockClear();
  vi.resetModules();
});

describe("Google social auth", () => {
  test("Better Auth uses its Google social provider", async () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = "better-auth";
    const { signInWithGoogle } = await import("../../src/lib/auth");

    await signInWithGoogle({ mode: "sign-in" });

    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/dashboard",
    });
  });

  test.each([
    ["sign-in", "/api/auth/workos/sign-in"],
    ["sign-up", "/api/auth/workos/sign-up"],
  ] as const)("WorkOS %s uses hosted AuthKit", async (mode, expectedPath) => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = "workos";
    const location = { href: "" };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location },
    });
    const { signInWithGoogle } = await import("../../src/lib/auth");

    await signInWithGoogle({ mode });

    expect(location.href).toBe(expectedPath);
    expect(signInSocial).not.toHaveBeenCalled();
  });
});
