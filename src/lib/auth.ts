"use client";

import * as React from "react";

import { authClient as betterAuthClient } from "./auth-client";

type ClientSession = {
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  } | null;
  session?: {
    activeOrganizationId?: string | null;
    roles?: string[];
    permissions?: string[];
  } | null;
} | null;

type AuthResult<T = unknown> = {
  data?: T | null;
  error?: { message?: string } | null;
};

const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? "better-auth";
const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

export type GoogleAuthMode = "sign-in" | "sign-up";

export function isGoogleSignInAvailable() {
  return authProvider === "workos" || googleAuthEnabled;
}

export function useAuthSession() {
  const [data, setData] = React.useState<ClientSession>(null);
  const [isPending, setIsPending] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let active = true;

    fetch("/api/auth/session", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load auth session");
        }

        return (await response.json()) as ClientSession;
      })
      .then((session) => {
        if (active) {
          setData(session);
        }
      })
      .catch((sessionError) => {
        if (active) {
          setError(sessionError instanceof Error ? sessionError : new Error("Auth session failed"));
        }
      })
      .finally(() => {
        if (active) {
          setIsPending(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { data, isPending, error };
}

export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  if (authProvider === "workos") {
    window.location.href = "/api/auth/workos/sign-in";
    return { data: null };
  }

  return await betterAuthClient.signIn.email(input);
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthResult> {
  if (authProvider === "workos") {
    window.location.href = "/api/auth/workos/sign-up";
    return { data: null };
  }

  return await betterAuthClient.signUp.email(input);
}

export async function signInWithGoogle(input: { mode: GoogleAuthMode }): Promise<AuthResult> {
  if (authProvider === "workos") {
    window.location.href =
      input.mode === "sign-up" ? "/api/auth/workos/sign-up" : "/api/auth/workos/sign-in";
    return { data: null };
  }

  return await betterAuthClient.signIn.social({
    provider: "google",
    callbackURL: "/dashboard",
  });
}

export async function createOrganization(input: {
  name: string;
  slug: string;
}): Promise<AuthResult<{ id: string }>> {
  if (authProvider === "workos") {
    return { data: null };
  }

  return await betterAuthClient.organization.create(input);
}

export async function setActiveOrganization(organizationId: string): Promise<AuthResult> {
  if (authProvider === "workos") {
    return { data: null };
  }

  return await betterAuthClient.organization.setActive({ organizationId });
}

export async function ensureActiveOrganization(session: ClientSession): Promise<boolean> {
  if (authProvider === "workos" || session?.session?.activeOrganizationId) {
    return true;
  }

  if (!session?.user) {
    return false;
  }

  const result = await betterAuthClient.organization.list();
  const firstOrg = result.data?.[0];

  if (firstOrg?.id) {
    await betterAuthClient.organization.setActive({ organizationId: firstOrg.id });
  }

  return true;
}

export async function signOut(): Promise<void> {
  if (authProvider === "workos") {
    window.location.href = "/api/auth/workos/sign-out";
    return;
  }

  await betterAuthClient.signOut();
}
