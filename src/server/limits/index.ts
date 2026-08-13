import Redis from "ioredis";

import { createLimitGuard } from "../modules/limits";
import { readLimitConfig } from "./config";
import { MemoryRateLimiter } from "./memory";
import { RedisRateLimiter } from "./redis";
import { DegradedRateLimiter } from "./degraded";

let guard: ReturnType<typeof createLimitGuard> | undefined;
let redis: Redis | undefined;

export function getLimitGuard() {
  if (guard) return guard;
  const config = readLimitConfig();
  const limiter =
    config.provider === "redis"
      ? new DegradedRateLimiter(
          new RedisRateLimiter(
            (redis ??= new Redis(config.redisUrl!, {
              lazyConnect: true,
              maxRetriesPerRequest: 1,
              enableOfflineQueue: false,
              connectTimeout: 5_000,
              commandTimeout: 2_000,
            })),
            config.prefix
          ),
          new MemoryRateLimiter()
        )
      : new MemoryRateLimiter();
  guard = createLimitGuard({
    limiter,
    mode: config.mode,
    tier: config.tier,
    emergencyMultiplier: config.emergencyMultiplier,
  });
  return guard;
}

export function resetLimitGuard() {
  guard = undefined;
}

export async function closeLimitGuard() {
  guard = undefined;
  const client = redis;
  redis = undefined;
  if (client) await client.quit().catch(() => client.disconnect());
}
