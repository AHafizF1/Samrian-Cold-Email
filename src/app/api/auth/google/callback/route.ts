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

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(request: NextRequest) {
  return withPublicLimit(request, "oauth.google.callback", (limitedRequest) =>
    callback(limitedRequest as NextRequest)
  );
}

async function callback(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Handle Google-side errors
  if (errorParam) {
    return errorRedirect(appUrl, errorParam, "google");
  }

  if (!code || !stateParam) {
    return errorRedirect(appUrl, "missing_code_or_state", "google");
  }

  // Validate state cookie exists (CSRF layer 1)
  const cookieName = getStateCookieName("google");
  const storedState = request.cookies.get(cookieName)?.value;
  if (!storedState) {
    return errorRedirect(appUrl, "missing_state_cookie", "google");
  }

  // Cookie must match the URL state param
  if (storedState !== stateParam) {
    return errorRedirect(appUrl, "state_cookie_mismatch", "google");
  }

  let session;
  try {
    session = await requireActiveOrg();
  } catch {
    return errorRedirect(appUrl, "session_expired", "google");
  }

  // Validate signed state (CSRF layer 2 — signature, timestamp, org/user binding)
  let validatedState;
  try {
    validatedState = validateOAuthState(stateParam, session.orgId, session.userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_state";
    return errorRedirect(appUrl, message, "google");
  }

  // Validate env
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorRedirect(appUrl, "missing_google_config", "google");
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`;

  // Exchange code for tokens
  let tokens;
  try {
    tokens = await exchangeCodeForTokens(GOOGLE_TOKEN_URL, {
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "token_exchange_failed";
    return errorRedirect(appUrl, message, "google");
  }

  // Fetch user email from Google userinfo
  let userEmail: string | undefined;
  try {
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (userinfoResponse.ok) {
      const userinfo = await userinfoResponse.json();
      userEmail = userinfo.email as string | undefined;
    }
  } catch {
    // Non-fatal — proceed without email
  }

  // Encrypt + save through Postgres mailbox repo.
  try {
    await saveOAuthMailbox({
      provider: "google",
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      userEmail,
      mailboxId: validatedState.mailboxId,
    });
  } catch {
    return errorRedirect(appUrl, "failed_to_save_mailbox", "google");
  }

  return successRedirect(appUrl, "google");
}
