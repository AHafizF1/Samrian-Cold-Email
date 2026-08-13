import { isIP } from "node:net";

import type { LimitGuard } from "../modules/limits";
import { getLimitGuard } from "./index";
import { RateLimitUnavailableError } from "./degraded";

export type TrustedProxyMode = "none" | "single";

export function getClientIp(headers: Headers, mode: TrustedProxyMode): string {
  if (mode === "none") return "unknown";
  const value = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return value && isIP(value) ? value : "unknown";
}

export function limitHeaders(
  decision: Awaited<ReturnType<LimitGuard["checkPublic"]>>,
  now: () => number = Date.now
): Record<string, string> {
  return {
    "ratelimit-policy": decision.policyId,
    "ratelimit-limit": String(decision.limit),
    "ratelimit-remaining": String(decision.remaining),
    "ratelimit-reset": String(Math.max(0, Math.ceil((decision.resetAt - now()) / 1000))),
    ...(decision.allowed
      ? {}
      : { "retry-after": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))) }),
  };
}

export function rateLimitResponse(
  decision: Awaited<ReturnType<LimitGuard["checkPublic"]>>
): Response {
  return Response.json(
    { error: { code: "RATE_LIMITED", message: "Rate limit exceeded" } },
    { status: 429, headers: limitHeaders(decision) }
  );
}

export async function withPublicLimit(
  request: Request,
  operationId: string,
  handler: (request: Request) => Promise<Response>,
  options: {
    guard?: LimitGuard;
    proxyMode?: TrustedProxyMode;
    penalizeStatuses?: number[];
  } = {}
): Promise<Response> {
  const guard = options.guard ?? getLimitGuard();
  const subject = getClientIp(
    request.headers,
    options.proxyMode ?? (process.env.TRUSTED_PROXY_MODE === "single" ? "single" : "none")
  );
  let decision;
  try {
    decision = await guard.checkPublic({ operationId, subject });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return Response.json(
        { error: { code: "PROVIDER_UNAVAILABLE", message: error.message } },
        { status: 503 }
      );
    }
    throw error;
  }
  if (!decision.allowed) {
    return rateLimitResponse(decision);
  }

  const response = await handler(request);
  if (options.penalizeStatuses?.includes(response.status)) {
    await guard.checkPublic({ operationId, subject, penalty: true });
  }
  for (const [name, value] of Object.entries(limitHeaders(decision))) {
    response.headers.set(name, value);
  }
  return response;
}
