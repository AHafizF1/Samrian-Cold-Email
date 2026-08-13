/**
 * OAuth Token Helpers (DRY — Shared by Google & Microsoft Callback Routes)
 *
 * Consolidates the duplicated token exchange, encryption, and mailbox storage
 * logic that was previously copy-pasted in both callback routes.
 */

import { NextResponse } from "next/server";
import { encryptCredential as encrypt } from "@/server/crypto";
import { requireOrgAccess } from "@/server/auth";
import { getDb } from "@/server/db/db";
import { getProviderPolicy } from "@/server/modules/providers";
import { newId, PostgresMailboxRepo, PostgresSettingsRepo } from "@/server/repos";
import { withTenant } from "@/server/db/tenant";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenExchangeResult {
  refreshToken: string;
  accessToken?: string;
  expiresIn?: number;
}

export interface OAuthMailboxData {
  provider: "google" | "microsoft";
  refreshToken: string;
  accessToken?: string;
  expiresIn?: number;
  userEmail?: string;
  mailboxId?: string;
}

// ── Shared Helpers ────────────────────────────────────────────────────────────

const STATE_COOKIE_PREFIX = {
  google: "google_oauth_state",
  microsoft: "microsoft_oauth_state",
} as const;

/**
 * Get the state cookie name for a provider.
 */
export function getStateCookieName(provider: "google" | "microsoft"): string {
  return STATE_COOKIE_PREFIX[provider];
}

/**
 * Build an error redirect response, clearing the state cookie.
 */
export function errorRedirect(
  appUrl: string,
  message: string,
  provider: "google" | "microsoft"
): NextResponse {
  const response = NextResponse.redirect(
    `${appUrl}/settings/mailboxes?error=${encodeURIComponent(message)}`
  );
  response.cookies.delete(getStateCookieName(provider));
  return response;
}

/**
 * Exchange an authorization code for tokens with the provider's token endpoint.
 */
export async function exchangeCodeForTokens(
  tokenEndpoint: string,
  params: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }
): Promise<TokenExchangeResult> {
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error ?? "token_exchange_failed");
  }

  if (!data.refresh_token) {
    throw new Error("no_refresh_token");
  }

  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Encrypt tokens and save/update the mailbox in Postgres.
 *
 * Encryption happens here in the Next.js server route through the credential Module.
 * Each blob is bound to its tenant, mailbox, provider, and field.
 */
export async function saveOAuthMailbox(data: OAuthMailboxData): Promise<void> {
  const { orgId } = await requireOrgAccess();
  const mailboxId = data.mailboxId ?? newId("mailbox");
  const context = {
    orgId,
    mailboxId,
    provider: data.provider,
  } as const;
  const encryptedRefreshToken = encrypt(data.refreshToken, {
    ...context,
    purpose: "refresh-token",
  });

  let encryptedAccessToken: string | undefined;
  if (data.accessToken) {
    encryptedAccessToken = encrypt(data.accessToken, {
      ...context,
      purpose: "access-token",
    });
  }

  const tokenExpiresAt = data.expiresIn ? Date.now() + data.expiresIn * 1000 : undefined;
  await withTenant(getDb(), { orgId, actorType: "request" }, async (tx) => {
    const repo = new PostgresMailboxRepo(tx);
    if (data.mailboxId) {
      await repo.reconnect(data.mailboxId, orgId, {
        encryptedRefreshToken,
        encryptedAccessToken,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined,
        userEmail: data.userEmail,
        clearHealth: true,
      });
      return;
    }

    const policy = getProviderPolicy(data.provider);
    const sending = await new PostgresSettingsRepo(tx).getSending(orgId);
    await repo.create({
      id: mailboxId,
      orgId,
      name: data.userEmail ?? `${data.provider} mailbox`,
      provider: data.provider,
      encryptedRefreshToken,
      encryptedAccessToken,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined,
      userEmail: data.userEmail ?? "",
      dailySendLimit: policy.recommendedDailyLimit,
      rampEnabled: sending.defaultRampEnabled,
      rampCurrentLimit: sending.defaultRampEnabled ? 5 : undefined,
      rampTargetLimit: Math.min(sending.defaultRampTarget, policy.maxSafeDailyLimit),
    });
  });
}

/**
 * Build a success redirect response, clearing the state cookie.
 */
export function successRedirect(appUrl: string, provider: "google" | "microsoft"): NextResponse {
  const response = NextResponse.redirect(`${appUrl}/settings/mailboxes`);
  response.cookies.delete(getStateCookieName(provider));
  return response;
}
