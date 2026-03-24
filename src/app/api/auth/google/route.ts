import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mailboxId = searchParams.get("mailboxId");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !appUrl) {
    return NextResponse.redirect(
      `${appUrl ?? ""}/settings/mailboxes?error=missing_google_config`
    );
  }

  // Generate random state for CSRF protection
  const state = crypto.randomBytes(16).toString("hex");

  const redirectUri = `${appUrl}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: mailboxId ? `${state}:${mailboxId}` : state,
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);

  // Store state in httpOnly cookie for CSRF validation
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
