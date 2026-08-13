import type Redis from "ioredis";

import type { LimitInput, RateLimiter } from "../modules/limits";

const consumeScript = `
local current = redis.call("INCRBY", KEYS[1], ARGV[1])
if current == tonumber(ARGV[1]) then
  redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
local ttl = redis.call("PTTL", KEYS[1])
local allowed = current <= tonumber(ARGV[3])
return { allowed and 1 or 0, math.max(0, tonumber(ARGV[3]) - current), ttl }
`;

export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly redis: Pick<Redis, "eval" | "connect" | "status">,
    private readonly prefix = "samrian:limits",
    private readonly now: () => number = Date.now
  ) {}

  async consume(input: LimitInput) {
    if (this.redis.status === "wait") {
      await this.redis.connect();
    }
    const key = `${this.prefix}:${input.policyId}:${input.subject}`;
    const raw = (await this.redis.eval(
      consumeScript,
      1,
      key,
      String(input.cost),
      String(input.windowMs),
      String(input.limit)
    )) as [number, number, number];
    const retryAfterMs = Math.max(1, Number(raw[2]));
    return {
      allowed: Number(raw[0]) === 1,
      limit: input.limit,
      remaining: Number(raw[1]),
      retryAfterMs: Number(raw[0]) === 1 ? 0 : retryAfterMs,
      resetAt: this.now() + retryAfterMs,
    };
  }
}
