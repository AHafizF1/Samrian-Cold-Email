import type { LimitInput, RateLimiter } from "../modules/limits";

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Rate limiting temporarily unavailable");
  }
}

export class DegradedRateLimiter implements RateLimiter {
  constructor(
    private readonly primary: RateLimiter,
    private readonly fallback: RateLimiter
  ) {}

  async consume(input: LimitInput) {
    try {
      return await this.primary.consume(input);
    } catch {
      if (failsClosed(input.policyId)) {
        throw new RateLimitUnavailableError();
      }
      return this.fallback.consume(input);
    }
  }
}

function failsClosed(policyId: string) {
  return (
    policyId.startsWith("public.") ||
    policyId.includes("api.high-impact") ||
    policyId.includes("api.provider-check")
  );
}
