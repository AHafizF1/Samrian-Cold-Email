import type { Logger } from "../observability/logs";
import { logger as defaultLogger } from "../observability/runtime";

export const planTiers = ["starter", "pro", "business", "enterprise", "self-hosted"] as const;
export type PlanTier = (typeof planTiers)[number];
export type LimitMode = "off" | "shadow" | "enforce";

export type LimitInput = {
  policyId: string;
  subject: string;
  limit: number;
  windowMs: number;
  cost: number;
};

export type LimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
  resetAt: number;
};

export interface RateLimiter {
  consume(input: LimitInput): Promise<LimitDecision>;
}

export type GuardDecision = LimitDecision & {
  policyId: string;
  shadowed?: boolean;
};

export interface LimitGuard {
  check(input: {
    operationId: string;
    orgId: string;
    credentialId: string;
  }): Promise<GuardDecision>;
  checkPublic(input: {
    operationId: string;
    subject: string;
    penalty?: boolean;
  }): Promise<GuardDecision>;
  checkSubject(input: {
    operationId: string;
    subjectType: "ip" | "user" | "token" | "worker";
    subject: string;
    penalty?: boolean;
  }): Promise<GuardDecision>;
}

type OperationPolicy = {
  id:
    | "api.read"
    | "api.write"
    | "api.bulk"
    | "api.provider-check"
    | "api.high-impact"
    | "public.auth"
    | "public.oauth"
    | "public.tracking"
    | "public.token";
  units: number;
  perMinute: Record<Exclude<PlanTier, "enterprise" | "self-hosted">, number>;
};

const tierLimits = {
  starter: { hourlyUnits: 20_000, burstUnits: 1_000 },
  pro: { hourlyUnits: 75_000, burstUnits: 3_000 },
  business: { hourlyUnits: 250_000, burstUnits: 10_000 },
  enterprise: { hourlyUnits: 500_000, burstUnits: 20_000 },
  "self-hosted": { hourlyUnits: 500_000, burstUnits: 20_000 },
} as const satisfies Record<PlanTier, { hourlyUnits: number; burstUnits: number }>;

const policies = {
  read: {
    id: "api.read",
    units: 1,
    perMinute: { starter: 120, pro: 300, business: 600 },
  },
  write: {
    id: "api.write",
    units: 5,
    perMinute: { starter: 30, pro: 90, business: 240 },
  },
  bulk: {
    id: "api.bulk",
    units: 10,
    perMinute: { starter: 20, pro: 60, business: 200 },
  },
  provider: {
    id: "api.provider-check",
    units: 20,
    perMinute: { starter: 10, pro: 30, business: 90 },
  },
  high: {
    id: "api.high-impact",
    units: 50,
    perMinute: { starter: 10, pro: 30, business: 60 },
  },
  auth: {
    id: "public.auth",
    units: 1,
    perMinute: { starter: 10, pro: 10, business: 10 },
  },
  oauth: {
    id: "public.oauth",
    units: 1,
    perMinute: { starter: 30, pro: 30, business: 30 },
  },
  tracking: {
    id: "public.tracking",
    units: 1,
    perMinute: { starter: 120, pro: 120, business: 120 },
  },
  token: {
    id: "public.token",
    units: 0,
    perMinute: { starter: 120, pro: 300, business: 600 },
  },
} as const satisfies Record<string, OperationPolicy>;

const bulkOperations = new Set([
  "contacts.import",
  "contacts.import-preview",
  "groups.preview",
  "analytics.export",
  "jobs.dispatch",
]);
const providerOperations = new Set(["domains.check", "mailboxes.check"]);
const highOperations = new Set(["campaigns.launch", "inbox.reply", "jobs.send"]);

export function getOperationPolicy(operationId: string): OperationPolicy {
  if (operationId.startsWith("auth.")) return policies.auth;
  if (operationId.startsWith("oauth.")) return policies.oauth;
  if (operationId.startsWith("tracking.")) return policies.tracking;
  if (operationId.startsWith("token.")) return policies.token;
  if (highOperations.has(operationId)) return policies.high;
  if (providerOperations.has(operationId)) return policies.provider;
  if (bulkOperations.has(operationId)) return policies.bulk;
  if (
    operationId.endsWith(".create") ||
    operationId.endsWith(".update") ||
    operationId.endsWith(".add") ||
    operationId.endsWith(".remove")
  ) {
    return policies.write;
  }
  return policies.read;
}

export function getTierLimits(tier: PlanTier) {
  return tierLimits[tier];
}

export function createLimitGuard(input: {
  limiter: RateLimiter;
  mode: LimitMode;
  tier: PlanTier;
  emergencyMultiplier?: number;
  logger?: Pick<Logger, "info" | "warn">;
}): LimitGuard {
  const logger = input.logger ?? defaultLogger;
  const multiplier = input.emergencyMultiplier ?? 1;

  return {
    async check(request) {
      if (input.mode === "off") return unlimited();
      const operation = getOperationPolicy(request.operationId);
      const tier = getTierLimits(input.tier);
      const perMinute = policyLimit(operation, input.tier);
      const checks: Array<LimitInput & { subjectType: "credential" | "org" }> = [
        {
          policyId: `credential.${operation.id}`,
          subject: `org:${request.orgId}:credential:${request.credentialId}:${operation.id}`,
          subjectType: "credential",
          limit: scaled(perMinute, multiplier),
          windowMs: 60_000,
          cost: 1,
        },
        {
          policyId: "org.hourly",
          subject: `org:${request.orgId}:hourly`,
          subjectType: "org",
          limit: scaled(tier.hourlyUnits, multiplier),
          windowMs: 3_600_000,
          cost: operation.units,
        },
        {
          policyId: "org.burst",
          subject: `org:${request.orgId}:burst`,
          subjectType: "org",
          limit: scaled(tier.burstUnits, multiplier),
          windowMs: 60_000,
          cost: operation.units,
        },
      ];

      let denied: GuardDecision | undefined;
      for (const check of checks) {
        const { subjectType, ...limitInput } = check;
        const decision = await input.limiter.consume(limitInput);
        if (!decision.allowed && !denied) {
          denied = { ...decision, policyId: check.policyId };
          logger.warn("rate_limit.denied", {
            policyId: check.policyId,
            subjectType,
            operation: request.operationId,
            retryAfterMs: decision.retryAfterMs,
            retryAfterSeconds: Math.max(1, Math.ceil(decision.retryAfterMs / 1000)),
            decision: input.mode === "shadow" ? "throttle" : "block",
            mode: input.mode,
          });
        }
      }

      if (!denied) {
        const primary = checks[0];
        return {
          allowed: true,
          policyId: primary.policyId,
          limit: primary.limit,
          remaining: primary.limit,
          retryAfterMs: 0,
          resetAt: Date.now() + primary.windowMs,
        };
      }
      if (input.mode === "shadow") {
        logger.info("rate_limit.shadowed", {
          policyId: denied.policyId,
          operation: request.operationId,
        });
        return { ...denied, allowed: true, shadowed: true };
      }
      return denied;
    },
    async checkPublic(request) {
      return this.checkSubject({ ...request, subjectType: "ip" });
    },
    async checkSubject(request) {
      if (input.mode === "off") return unlimited();
      const operation = getOperationPolicy(request.operationId);
      const limit = scaled(policyLimit(operation, input.tier), multiplier);
      const decision = await input.limiter.consume({
        policyId: operation.id,
        subject: `${request.subjectType}:${request.subject}:${operation.id}`,
        limit,
        windowMs: 60_000,
        cost: request.penalty ? Math.max(5, operation.units) : operation.units,
      });
      const result = { ...decision, policyId: operation.id };
      if (!decision.allowed) {
        logger.warn("rate_limit.denied", {
          policyId: operation.id,
          subjectType: request.subjectType,
          operation: request.operationId,
          decision: input.mode === "shadow" ? "throttle" : "block",
          retryAfterMs: decision.retryAfterMs,
          retryAfterSeconds: Math.max(1, Math.ceil(decision.retryAfterMs / 1000)),
          mode: input.mode,
        });
      }
      return input.mode === "shadow" && !decision.allowed
        ? { ...result, allowed: true, shadowed: true }
        : result;
    },
  };
}

function policyLimit(policy: OperationPolicy, tier: PlanTier) {
  if (tier === "enterprise" || tier === "self-hosted") return policy.perMinute.business * 2;
  return policy.perMinute[tier];
}

function scaled(value: number, multiplier: number) {
  return Math.max(1, Math.floor(value * multiplier));
}

function unlimited(): GuardDecision {
  return {
    allowed: true,
    policyId: "disabled",
    limit: Number.MAX_SAFE_INTEGER,
    remaining: Number.MAX_SAFE_INTEGER,
    retryAfterMs: 0,
    resetAt: 0,
  };
}
