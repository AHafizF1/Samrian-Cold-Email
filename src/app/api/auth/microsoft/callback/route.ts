import { NextRequest } from "next/server";
import { requireActiveOrg } from "@/server/auth";
import { validateOAuthState } from "../../../../../../lib/oauth-state";
import {
  errorRedirect,
  exchangeCodeForTokens,
  saveOAuthMailbox,
  successRedirect,
  getStateCookieName,
} from "../../../../../../lib/oauth-helpers";
import { withPublicLimit } from "@/server/limits/http";

// Support configurable tenant ID (default: common for multi-tenant)
const TENANT_ID = process.env.MICROSOFT_TENANT_ID ?? "common";
const MICROSOFT_TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

export async function GET(request: NextRequest) {
  return withPublicLimit(request, "oauth.microsoft.callback", (limitedRequest) =>
    callback(limitedRequest as NextRequest)
  );
}

async function callback(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Handle Microsoft-side errors
  if (errorParam) {
    return errorRedirect(appUrl, errorParam, "microsoft");
  }

  if (!code || !stateParam) {
    return errorRedirect(appUrl, "missing_code_or_state", "microsoft");
  }

  // Validate state cookie exists (CSRF layer 1)
  const cookieName = getStateCookieName("microsoft");
  const storedState = request.cookies.get(cookieName)?.value;
  if (!storedState) {
    return errorRedirect(appUrl, "missing_state_cookie", "microsoft");
  }

  // Cookie must match the URL state param
  if (storedState !== stateParam) {
    return errorRedirect(appUrl, "state_cookie_mismatch", "microsoft");
  }

  let session;
  try {
    session = await requireActiveOrg();
  } catch {
    return errorRedirect(appUrl, "session_expired", "microsoft");
  }

  // Validate signed state (CSRF layer 2 — signature, timestamp, org/user binding)
  let validatedState;
  try {
    validatedState = validateOAuthState(stateParam, session.orgId, session.userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_state";
    return errorRedirect(appUrl, message, "microsoft");
  }

  // Validate env
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorRedirect(appUrl, "missing_microsoft_config", "microsoft");
  }

  const redirectUri = `${appUrl}/api/auth/microsoft/callback`;

  // Exchange code for tokens (DRY — shared helper)
  let tokens;
  try {
    tokens = await exchangeCodeForTokens(MICROSOFT_TOKEN_URL, {
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "token_exchange_failed";
    return errorRedirect(appUrl, message, "microsoft");
  }

  // Fetch user email from Microsoft Graph
  let userEmail: string | undefined;
  try {
    const meResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (meResponse.ok) {
      const me = await meResponse.json();
      userEmail = (me.mail ?? me.userPrincipalName) as string | undefined;
    }
  } catch {
    // Non-fatal — proceed without email
  }

  // Encrypt + save through Postgres mailbox repo.
  try {
    await saveOAuthMailbox({
      provider: "microsoft",
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      userEmail,
      mailboxId: validatedState.mailboxId,
    });
  } catch {
    return errorRedirect(appUrl, "failed_to_save_mailbox", "microsoft");
  }

  return successRedirect(appUrl, "microsoft");
}
