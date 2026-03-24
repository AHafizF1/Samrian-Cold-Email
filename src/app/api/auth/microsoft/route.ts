import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const MICROSOFT_AUTH_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const SCOPES = ["Mail.Send", "Mail.Read", "offline_access"].join(" ");

const STATE_COOKIE = "microsoft_oauth_state";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mailboxId = searchParams.get("mailboxId");

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !appUrl) {
    return NextResponse.redirect(
      `${appUrl ?? ""}/settings/mailboxes?error=missing_microsoft_config`
    );
  }

  // Generate random state for CSRF protection
  const state = crypto.randomBytes(16).toString("hex");

  const redirectUri = `${appUrl}/api/auth/microsoft/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    response_mode: "query",
    state: mailboxId ? `${state}:${mailboxId}` : state,
  });

  const response = NextResponse.redirect(
    `${MICROSOFT_AUTH_URL}?${params.toString()}`
  );

  // Store state in httpOnly cookie for CSRF validation
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
