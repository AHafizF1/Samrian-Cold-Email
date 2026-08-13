import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const DISPATCH_BATCH_LIMIT = 100;
export const DISPATCH_CRON = "*/5 * * * *";
export const DISPATCH_TIMEZONE = "UTC";
export const DEFAULT_FOLLOW_UP_DELAY_DAYS = 3;
export const SEND_JITTER_MIN_MS = 5_000;
export const SEND_JITTER_MAX_MS = 45_000;

type CampaignSchedule = {
  timezone?: string;
  defaultTimezone?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: readonly string[];
  days?: readonly string[];
};

type StepDelay = {
  delayDays?: number;
  delayHours?: number;
};

type WindowInput = {
  schedule?: CampaignSchedule | null;
  contactTimezone?: string;
  now: number;
};

export function isInSendWindow(input: WindowInput): boolean {
  const schedule = input.schedule ?? {};
  const timezone = resolveTimezone(schedule, input.contactTimezone);
  const zoned = toZonedTime(new Date(input.now), timezone);
  const day = weekday(zoned);
  const allowedDays = schedule.daysOfWeek ?? schedule.days;

  if (allowedDays?.length && !allowedDays.map((item) => item.toLowerCase()).includes(day)) {
    return false;
  }

  const minutes = zoned.getHours() * 60 + zoned.getMinutes();
  return (
    minutes >= parseTime(schedule.startTime ?? "00:00") &&
    minutes < parseTime(schedule.endTime ?? "23:59")
  );
}

export function nextWindowStart(input: WindowInput): number {
  const schedule = input.schedule ?? {};
  const timezone = resolveTimezone(schedule, input.contactTimezone);
  const start = schedule.startTime ?? "00:00";
  const [hour, minute] = start.split(":").map((part) => Number.parseInt(part, 10));

  for (let offset = 0; offset < 14; offset += 1) {
    const zoned = toZonedTime(new Date(input.now), timezone);
    zoned.setDate(zoned.getDate() + offset);
    zoned.setHours(hour, minute, 0, 0);
    const candidate = fromZonedTime(zoned, timezone).getTime();
    if (candidate > input.now && isInSendWindow({ ...input, now: candidate })) {
      return candidate;
    }
  }

  return input.now + 24 * 60 * 60 * 1000;
}

export function getStepDelayMs(steps: readonly unknown[], stepNumber: number): number {
  if (stepNumber <= 0) return 0;
  const step = steps[stepNumber] as StepDelay | undefined;
  const days = step?.delayDays ?? DEFAULT_FOLLOW_UP_DELAY_DAYS;
  const hours = step?.delayHours ?? 0;
  return (days * 24 + hours) * 60 * 60 * 1000;
}

export function getJitterMs(
  input: {
    minMs?: number;
    maxMs?: number;
    random?: () => number;
  } = {}
): number {
  const minMs = input.minMs ?? SEND_JITTER_MIN_MS;
  const maxMs = input.maxMs ?? SEND_JITTER_MAX_MS;
  const random = input.random ?? Math.random;
  if (maxMs <= minMs) return minMs;
  return Math.round(minMs + (maxMs - minMs) * random());
}

function resolveTimezone(schedule: CampaignSchedule, contactTimezone: string | undefined) {
  return contactTimezone ?? schedule.timezone ?? schedule.defaultTimezone ?? "UTC";
}

function parseTime(value: string): number {
  const [hour, minute] = value.split(":").map((part) => Number.parseInt(part, 10));
  return hour * 60 + minute;
}

function weekday(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();
}
