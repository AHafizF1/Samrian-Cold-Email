import { TokenRefreshError } from "./errors";
import { deadlineSignal } from "../../src/server/network/deadline";
import { readJsonResponse } from "../../src/server/http/body";

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

  if (!clientId)
    throw new TokenRefreshError(`Missing ${prefix}_CLIENT_ID environment variable`, provider);
  if (!clientSecret) {
    throw new TokenRefreshError(`Missing ${prefix}_CLIENT_SECRET environment variable`, provider);
  }

  const response = await fetch(TOKEN_ENDPOINTS[provider], {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: deadlineSignal(),
  });

  const data = await readJsonResponse<Record<string, unknown>>(response, 64 * 1024).catch(
    (): Record<string, unknown> => ({})
  );

  if (!response.ok) {
    const error = typeof data.error === "string" ? data.error : response.statusText;
    const description = typeof data.error_description === "string" ? data.error_description : "";
    throw new TokenRefreshError(
      `Token refresh failed for ${provider}: ${error}${description ? ` - ${description}` : ""}`,
      provider
    );
  }

  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new TokenRefreshError(`Missing access_token in ${provider} token response`, provider);
  }

  return {
    accessToken: data.access_token,
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : 3600,
  };
}
