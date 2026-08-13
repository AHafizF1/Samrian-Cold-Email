import { NextRequest, NextResponse } from "next/server";
import { requireActiveOrg } from "@/server/auth";
import { createOAuthState } from "../../../../../lib/oauth-state";
import { getStateCookieName } from "../../../../../lib/oauth-helpers";
import { withPublicLimit } from "@/server/limits/http";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

export async function GET(request: NextRequest) {
  return withPublicLimit(request, "oauth.google.start", (limitedRequest) =>
    start(limitedRequest as NextRequest)
  );
}

async function start(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId || !appUrl) {
    return NextResponse.redirect(`${appUrl}/settings/mailboxes?error=missing_google_config`);
  }

  let session;
  try {
    session = await requireActiveOrg();
  } catch {
    return NextResponse.redirect(`${appUrl}/sign-in?error=unauthenticated`);
  }

  const { searchParams } = request.nextUrl;
  const mailboxId = searchParams.get("mailboxId") ?? undefined;

  // Create signed, timestamped, org-bound state
  const state = createOAuthState(session.orgId, session.userId, mailboxId);

  const redirectUri = `${appUrl}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);

  // Store state nonce in httpOnly cookie for additional CSRF validation
  const cookieName = getStateCookieName("google");
  response.cookies.set(cookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
