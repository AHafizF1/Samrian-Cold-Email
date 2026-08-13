import type { AuthProviderName } from "./port";

type Env = Record<string, string | undefined>;

const workosEnv = [
  "WORKOS_API_KEY",
  "WORKOS_CLIENT_ID",
  "WORKOS_COOKIE_PASSWORD",
  "NEXT_PUBLIC_WORKOS_REDIRECT_URI",
] as const;

export function getAuthProviderName(env: Env = process.env): AuthProviderName {
  const provider = env.AUTH_PROVIDER ?? "better-auth";

  if (provider === "better-auth" || provider === "workos") {
    return provider;
  }

  throw new Error(`Unsupported AUTH_PROVIDER: ${provider}`);
}

export function getGoogleAuthConfig(
  env: Env = process.env
): { enabled: true; clientId: string; clientSecret: string } | { enabled: false } {
  if (getAuthProviderName(env) === "workos") {
    return { enabled: false };
  }

  const clientId = env.GOOGLE_AUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_AUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { enabled: false };
  }

  return { enabled: true, clientId, clientSecret };
}

export function requireWorkosConfig(env: Env = process.env) {
  const missing = workosEnv.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing WorkOS auth config: ${missing.join(", ")}`);
  }
}
