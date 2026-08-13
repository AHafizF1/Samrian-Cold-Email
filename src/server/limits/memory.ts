import type { LimitInput, RateLimiter } from "../modules/limits";

type Window = { used: number; resetAt: number };

export class MemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly now: () => number = Date.now) {}

  async consume(input: LimitInput) {
    const now = this.now();
    const key = `${input.policyId}:${input.subject}`;
    const current = this.windows.get(key);
    const window =
      !current || current.resetAt <= now ? { used: 0, resetAt: now + input.windowMs } : current;
    const next = window.used + input.cost;
    if (next > input.limit) {
      this.windows.set(key, window);
      return {
        allowed: false,
        limit: input.limit,
        remaining: Math.max(0, input.limit - window.used),
        retryAfterMs: Math.max(1, window.resetAt - now),
        resetAt: window.resetAt,
      };
    }
    window.used = next;
    this.windows.set(key, window);
    return {
      allowed: true,
      limit: input.limit,
      remaining: Math.max(0, input.limit - next),
      retryAfterMs: 0,
      resetAt: window.resetAt,
    };
  }
}
