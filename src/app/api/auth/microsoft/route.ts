import { NextRequest, NextResponse } from "next/server";
import { requireActiveOrg } from "@/server/auth";
import { createOAuthState } from "../../../../../lib/oauth-state";
import { getStateCookieName } from "../../../../../lib/oauth-helpers";
import { withPublicLimit } from "@/server/limits/http";

// Support configurable tenant ID (default: common for multi-tenant)
const TENANT_ID = process.env.MICROSOFT_TENANT_ID ?? "common";
const MICROSOFT_AUTH_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`;
const SCOPES = ["Mail.Send", "Mail.ReadWrite", "offline_access"].join(" ");

export async function GET(request: NextRequest) {
  return withPublicLimit(request, "oauth.microsoft.start", (limitedRequest) =>
    start(limitedRequest as NextRequest)
  );
}

async function start(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const clientId = process.env.MICROSOFT_CLIENT_ID;

  if (!clientId || !appUrl) {
    return NextResponse.redirect(`${appUrl}/settings/mailboxes?error=missing_microsoft_config`);
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

  const redirectUri = `${appUrl}/api/auth/microsoft/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    response_mode: "query",
    state,
  });

  const response = NextResponse.redirect(`${MICROSOFT_AUTH_URL}?${params.toString()}`);

  // Store state nonce in httpOnly cookie for additional CSRF validation
  const cookieName = getStateCookieName("microsoft");
  response.cookies.set(cookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
