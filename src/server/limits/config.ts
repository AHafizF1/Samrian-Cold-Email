import { planTiers, type LimitMode, type PlanTier } from "../modules/limits";

export type LimitConfig = {
  provider: "memory" | "redis";
  mode: LimitMode;
  tier: PlanTier;
  emergencyMultiplier: number;
  redisUrl?: string;
  prefix: string;
};

export function readLimitConfig(
  env: Record<string, string | undefined> = process.env
): LimitConfig {
  const production = env.NODE_ENV === "production";
  const mode = (env.RATE_LIMIT_MODE || (production ? "enforce" : "off")) as LimitMode;
  if (!["off", "shadow", "enforce"].includes(mode)) {
    throw new Error("RATE_LIMIT_MODE must be off, shadow, or enforce");
  }

  const provider = (env.RATE_LIMIT_PROVIDER || (production ? "redis" : "memory")) as
    "memory" | "redis";
  if (provider !== "memory" && provider !== "redis") {
    throw new Error("RATE_LIMIT_PROVIDER must be memory or redis");
  }
  if (production && mode === "enforce" && provider !== "redis") {
    throw new Error("RATE_LIMIT_PROVIDER must be redis in enforced production mode");
  }
  if (provider === "redis" && !env.REDIS_URL?.trim()) {
    throw new Error("REDIS_URL is required when RATE_LIMIT_PROVIDER=redis");
  }
  if (production && mode === "enforce" && env.TRUSTED_PROXY_MODE !== "single") {
    throw new Error(
      "TRUSTED_PROXY_MODE must be single in enforced production mode; trusted proxy must overwrite X-Forwarded-For"
    );
  }

  const tier = (env.RATE_LIMIT_TIER || "starter") as PlanTier;
  if (!(planTiers as readonly string[]).includes(tier)) {
    throw new Error("RATE_LIMIT_TIER is invalid");
  }
  const emergencyMultiplier = Number(env.RATE_LIMIT_EMERGENCY_MULTIPLIER || "1");
  if (
    !Number.isFinite(emergencyMultiplier) ||
    emergencyMultiplier <= 0 ||
    emergencyMultiplier > 1
  ) {
    throw new Error("RATE_LIMIT_EMERGENCY_MULTIPLIER must be greater than 0 and at most 1");
  }

  return {
    provider,
    mode,
    tier,
    emergencyMultiplier,
    ...(env.REDIS_URL ? { redisUrl: env.REDIS_URL } : {}),
    prefix: env.RATE_LIMIT_REDIS_PREFIX || "samrian:limits",
  };
}
