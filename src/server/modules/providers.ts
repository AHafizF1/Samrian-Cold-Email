import type { ProviderType } from "../../../lib/email-connectors/types";

export type ProviderPolicy = {
  recommendedDailyLimit: number;
  maxSafeDailyLimit: number;
  pollIntervalMs: number;
  retryClass: "oauth-rate-limited" | "graph-retry-after" | "smtp-4xx-retry" | "managed-pool";
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const POLICIES: Record<ProviderType, ProviderPolicy> = {
  google: {
    recommendedDailyLimit: 20,
    maxSafeDailyLimit: 100,
    pollIntervalMs: FIVE_MINUTES_MS,
    retryClass: "oauth-rate-limited",
  },
  microsoft: {
    recommendedDailyLimit: 20,
    maxSafeDailyLimit: 100,
    pollIntervalMs: FIVE_MINUTES_MS,
    retryClass: "graph-retry-after",
  },
  smtp: {
    recommendedDailyLimit: 25,
    maxSafeDailyLimit: 100,
    pollIntervalMs: FIVE_MINUTES_MS,
    retryClass: "smtp-4xx-retry",
  },
  puzzle: {
    recommendedDailyLimit: 50,
    maxSafeDailyLimit: 500,
    pollIntervalMs: FIVE_MINUTES_MS,
    retryClass: "managed-pool",
  },
  mailpool: {
    recommendedDailyLimit: 50,
    maxSafeDailyLimit: 500,
    pollIntervalMs: FIVE_MINUTES_MS,
    retryClass: "managed-pool",
  },
};

export function getProviderPolicy(provider: ProviderType): ProviderPolicy {
  return POLICIES[provider];
}

export function clampDailyLimit(provider: ProviderType, requested: number): number {
  const policy = getProviderPolicy(provider);
  if (!Number.isFinite(requested)) return policy.recommendedDailyLimit;
  return Math.min(Math.max(Math.trunc(requested), 1), policy.maxSafeDailyLimit);
}
