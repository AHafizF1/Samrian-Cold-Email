export const RAMP_STATUSES = [
  "disabled",
  "pending",
  "ramping",
  "ready",
  "held",
  "reduced",
  "paused",
  "recovering",
] as const;

export type RampStatus = (typeof RAMP_STATUSES)[number];

export type RampReason =
  | "disabled"
  | "pending"
  | "healthy"
  | "target-reached"
  | "age-stage"
  | "insufficient-sample"
  | "delivery-pressure"
  | "hard-bounce-rate"
  | "unsubscribe-rate"
  | "provider-throttle"
  | "mailbox-unavailable"
  | "domain-failed"
  | "recovering";

export type RampInput = {
  enabled: boolean;
  status: RampStatus;
  mailboxStatus: string;
  startedAt?: number;
  currentLimit: number;
  targetLimit: number;
  increment: number;
  nextCheckAt?: number;
  sent: number;
  failed: number;
  hardBounces: number;
  softBounces: number;
  unsubscribes: number;
  providerLimitResetAt?: number;
  archived: boolean;
  domainStatus?: "pass" | "warn" | "unknown" | "fail";
  now: number;
};

export type RampDecision = {
  status: RampStatus;
  currentLimit: number;
  reason: RampReason;
  holdUntil?: number;
  nextCheckAt: number;
};

export type MailboxCapacityInput = {
  providerLimit: number;
  userLimit: number;
  rampEnabled?: boolean;
  rampLimit?: number;
  sentToday?: number;
  reserved?: number;
  replyReserve?: number;
};

export type MailboxCapacity = {
  effectiveLimit: number;
  campaignLimit: number;
  used: number;
  available: number;
  utilization: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SAMPLE = 10;
const HARD_BOUNCE_PAUSE_RATE = 0.05;
const UNSUBSCRIBE_PAUSE_RATE = 0.1;
const DELIVERY_PRESSURE_RATE = 0.15;

export function getMailboxCapacity(input: MailboxCapacityInput): MailboxCapacity {
  const providerLimit = positiveInt(input.providerLimit);
  const userLimit = positiveInt(input.userLimit);
  const rampLimit =
    input.rampEnabled && input.rampLimit ? positiveInt(input.rampLimit) : Number.POSITIVE_INFINITY;
  const effectiveLimit = Math.min(providerLimit, userLimit, rampLimit);
  const replyReserve = Math.min(nonNegativeInt(input.replyReserve), effectiveLimit);
  const campaignLimit = Math.max(0, effectiveLimit - replyReserve);
  const used = nonNegativeInt(input.sentToday) + nonNegativeInt(input.reserved);
  const available = Math.max(0, campaignLimit - used);

  return {
    effectiveLimit,
    campaignLimit,
    used,
    available,
    utilization: effectiveLimit > 0 ? Math.min(used / effectiveLimit, 1) : 1,
  };
}

export function evaluateRamp(input: RampInput): RampDecision {
  const nextCheckAt = input.now + DAY_MS;
  const floor = Math.min(5, positiveInt(input.targetLimit));

  if (!input.enabled) {
    return {
      status: "disabled",
      currentLimit: input.currentLimit,
      reason: "disabled",
      nextCheckAt,
    };
  }
  if (input.archived || input.mailboxStatus === "disconnected") {
    return {
      status: "paused",
      currentLimit: Math.min(input.currentLimit, floor),
      reason: "mailbox-unavailable",
      nextCheckAt,
    };
  }
  if (input.domainStatus === "fail") {
    return {
      status: "paused",
      currentLimit: Math.min(input.currentLimit, floor),
      reason: "domain-failed",
      nextCheckAt,
    };
  }
  if (input.providerLimitResetAt && input.providerLimitResetAt > input.now) {
    return {
      status: "held",
      currentLimit: input.currentLimit,
      reason: "provider-throttle",
      holdUntil: input.providerLimitResetAt,
      nextCheckAt: input.providerLimitResetAt,
    };
  }
  if (input.mailboxStatus === "limit_reached") {
    return {
      status: "held",
      currentLimit: input.currentLimit,
      reason: "provider-throttle",
      nextCheckAt,
    };
  }
  if (input.status === "paused" || input.status === "reduced") {
    return {
      status: "recovering",
      currentLimit: input.currentLimit,
      reason: "recovering",
      nextCheckAt,
    };
  }

  const sample = Math.max(input.sent, 0);
  const hardBounceRate = rate(input.hardBounces, sample);
  const unsubscribeRate = rate(input.unsubscribes, sample);
  const pressureRate = rate(input.failed + input.softBounces, sample);

  if (sample >= MIN_SAMPLE && hardBounceRate >= HARD_BOUNCE_PAUSE_RATE) {
    return {
      status: "paused",
      currentLimit: floor,
      reason: "hard-bounce-rate",
      nextCheckAt,
    };
  }
  if (sample >= MIN_SAMPLE && unsubscribeRate >= UNSUBSCRIBE_PAUSE_RATE) {
    return {
      status: "paused",
      currentLimit: floor,
      reason: "unsubscribe-rate",
      nextCheckAt,
    };
  }
  if (sample >= MIN_SAMPLE && pressureRate >= DELIVERY_PRESSURE_RATE) {
    return {
      status: "reduced",
      currentLimit: Math.max(floor, input.currentLimit - positiveInt(input.increment)),
      reason: "delivery-pressure",
      nextCheckAt,
    };
  }
  if (sample < Math.max(MIN_SAMPLE, input.currentLimit)) {
    return {
      status: "held",
      currentLimit: input.currentLimit,
      reason: "insufficient-sample",
      nextCheckAt,
    };
  }

  const ageLimit = getRampAgeLimit(input.startedAt, input.now, input.targetLimit);
  if (ageLimit <= input.currentLimit) {
    return {
      status: "held",
      currentLimit: input.currentLimit,
      reason: "age-stage",
      nextCheckAt,
    };
  }
  const currentLimit = Math.min(
    positiveInt(input.targetLimit),
    ageLimit,
    input.currentLimit + positiveInt(input.increment)
  );
  return currentLimit >= input.targetLimit
    ? { status: "ready", currentLimit, reason: "target-reached", nextCheckAt }
    : { status: "ramping", currentLimit, reason: "healthy", nextCheckAt };
}

export function getRampAgeLimit(startedAt: number | undefined, now: number, targetLimit: number) {
  if (!startedAt) return 5;
  const day = Math.max(0, Math.floor((now - startedAt) / DAY_MS));
  if (day < 3) return 5;
  if (day < 7) return 10;
  if (day < 14) return 15;
  if (day < 21) return 20;
  if (day < 28) return 25;
  return positiveInt(targetLimit);
}

function positiveInt(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.trunc(value ?? 1));
}

function nonNegativeInt(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value ?? 0));
}

function rate(count: number, sample: number): number {
  return sample > 0 ? Math.max(count, 0) / sample : 0;
}
