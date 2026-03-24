/**
 * Centralized OAuth2 token refresh helper
 *
 * Supports Google and Microsoft providers.
 * Used internally by connector implementations (not a Convex action).
 */

import { TokenRefreshError } from "./errors";

const TOKEN_ENDPOINTS = {
  google: "https://oauth2.googleapis.com/token",
  microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
} as const;

export async function refreshAccessToken(
  provider: "google" | "microsoft",
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const prefix = provider.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];

  if (!clientId) {
    throw new TokenRefreshError(
      `Missing ${prefix}_CLIENT_ID environment variable`,
      provider
    );
  }
  if (!clientSecret) {
    throw new TokenRefreshError(
      `Missing ${prefix}_CLIENT_SECRET environment variable`,
      provider
    );
  }

  const tokenEndpoint = TOKEN_ENDPOINTS[provider];

  let response: Response;
  try {
    response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
  } catch (err) {
    throw new TokenRefreshError(
      `Network error during token refresh for ${provider}: ${err instanceof Error ? err.message : String(err)}`,
      provider
    );
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new TokenRefreshError(
      `Invalid JSON response from ${provider} token endpoint`,
      provider
    );
  }

  if (!response.ok) {
    const error = typeof data.error === "string" ? data.error : "";
    const description =
      typeof data.error_description === "string" ? data.error_description : "";

    if (error === "invalid_grant") {
      throw new TokenRefreshError(
        `Refresh token is invalid or has been revoked for ${provider}. The user must re-authenticate.`,
        provider
      );
    }

    throw new TokenRefreshError(
      `Token refresh failed for ${provider}: ${error || response.statusText}${description ? ` — ${description}` : ""}`,
      provider
    );
  }

  const accessToken = data.access_token;
  const expiresIn = data.expires_in;

  if (typeof accessToken !== "string" || !accessToken) {
    throw new TokenRefreshError(
      `Missing access_token in ${provider} token response`,
      provider
    );
  }

  return {
    accessToken,
    expiresIn: typeof expiresIn === "number" ? expiresIn : 3600,
  };
}
