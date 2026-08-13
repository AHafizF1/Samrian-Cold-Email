import {
  DISPATCH_BATCH_LIMIT,
  DISPATCH_CRON,
  SEND_JITTER_MAX_MS,
  SEND_JITTER_MIN_MS,
} from "../src/server/jobs/schedule";

/** Compatibility names for older Inngest wrapper imports. Keep values single-sourced in jobs/schedule. */
export const DISPATCHER_CRON = DISPATCH_CRON;

/** Max concurrent sendCampaignEmail executions across all mailboxes. */
export const SEND_CONCURRENCY_LIMIT = 3;

/** Max concurrent executions per individual mailbox (prevents SMTP flooding). */
export const SEND_CONCURRENCY_PER_MAILBOX = 1;

/** Max Inngest retry attempts for the send worker. */
export const SEND_RETRIES = 3;

export const JITTER_MIN_MS = SEND_JITTER_MIN_MS;

export const JITTER_MAX_MS = SEND_JITTER_MAX_MS;

/** Bounce rate threshold above which a campaign is auto-paused. */
export const BOUNCE_RATE_THRESHOLD = 0.05; // 5 %

export const MAX_ELIGIBLE_PER_TICK = DISPATCH_BATCH_LIMIT;

/** Default minimum delay between email steps if none is configured (ms). */
export const DEFAULT_STEP_DELAY_MS = 172_800_000; // 2 days

/** Reply polling cron — embedded inside the dispatcher tick; kept here for reference. */
export const REPLY_POLL_EVENT = "mailbox/poll/all";
