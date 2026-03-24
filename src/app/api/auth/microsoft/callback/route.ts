import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

const MICROSOFT_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const STATE_COOKIE = "microsoft_oauth_state";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function encryptToken(plaintext: string): { ciphertext: string; iv: string } {
  const key = process.env.MASTER_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("MASTER_ENCRYPTION_KEY must be a 64-character hex string");
  }
  const masterKey = Buffer.from(key, "hex");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  const ciphertext = encrypted + authTag.toString("hex");

  return { ciphertext, iv: iv.toString("hex") };
}

function errorRedirect(appUrl: string, message: string): NextResponse {
  const response = NextResponse.redirect(
    `${appUrl}/settings/mailboxes?error=${encodeURIComponent(message)}`
  );
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Handle Microsoft-side errors
  if (errorParam) {
    return errorRedirect(appUrl, errorParam);
  }

  if (!code || !stateParam) {
    return errorRedirect(appUrl, "missing_code_or_state");
  }

  // Validate CSRF state
  const storedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!storedState) {
    return errorRedirect(appUrl, "missing_state_cookie");
  }

  // State may be "state:mailboxId" or just "state"
  const [incomingState, mailboxId] = stateParam.split(":");
  if (incomingState !== storedState) {
    return errorRedirect(appUrl, "invalid_state");
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return errorRedirect(appUrl, "missing_microsoft_config");
  }

  const redirectUri = `${appUrl}/api/auth/microsoft/callback`;

  // Exchange authorization code for tokens
  let tokenData: {
    refresh_token?: string;
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  try {
    const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      return errorRedirect(appUrl, tokenData.error ?? "token_exchange_failed");
    }
  } catch {
    return errorRedirect(appUrl, "token_exchange_failed");
  }

  const { refresh_token, access_token, expires_in } = tokenData;

  if (!refresh_token) {
    return errorRedirect(appUrl, "no_refresh_token");
  }

  // Fetch user email from Microsoft Graph
  let userEmail: string | undefined;
  try {
    const meResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (meResponse.ok) {
      const me = await meResponse.json();
      userEmail = (me.mail ?? me.userPrincipalName) as string | undefined;
    }
  } catch {
    // Non-fatal — proceed without email
  }

  // Encrypt the refresh token (and optionally access token) server-side
  let encryptedRefreshToken: string;
  let iv: string;
  let encryptedAccessToken: string | undefined;

  try {
    const result = encryptToken(refresh_token);
    encryptedRefreshToken = result.ciphertext;
    iv = result.iv;

    if (access_token) {
      const atResult = encryptToken(access_token);
      encryptedAccessToken = `${atResult.iv}:${atResult.ciphertext}`;
    }
  } catch {
    return errorRedirect(appUrl, "encryption_failed");
  }

  const tokenExpiresAt = expires_in
    ? Date.now() + expires_in * 1000
    : undefined;

  try {
    if (mailboxId) {
      // Update existing mailbox (reconnect flow)
      await fetchAuthMutation(api.mutations.mailboxes.update, {
        id: mailboxId as Id<"mailboxes">,
        refreshToken: encryptedRefreshToken,
        accessToken: encryptedAccessToken,
        tokenExpiresAt,
        userEmail,
        iv,
      });
    } else {
      // Create new mailbox
      await fetchAuthMutation(api.mutations.mailboxes.create, {
        name: userEmail ? `Outlook (${userEmail})` : "Outlook",
        provider: "microsoft",
        refreshToken: encryptedRefreshToken,
        accessToken: encryptedAccessToken,
        tokenExpiresAt,
        userEmail,
        iv,
        dailySendLimit: 500,
      });
    }
  } catch {
    return errorRedirect(appUrl, "failed_to_save_mailbox");
  }

  // Success — clear state cookie and redirect
  const response = NextResponse.redirect(`${appUrl}/settings/mailboxes`);
  response.cookies.delete(STATE_COOKIE);
  return response;
}
