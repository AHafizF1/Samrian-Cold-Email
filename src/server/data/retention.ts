const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const RETENTION = {
  oauthStateMs: 10 * 60 * 1000,
  apiIdempotencyMs: DAY,
  exportsMs: DAY,
  notificationsDays: 90,
  rawEventsDays: 365,
  deletedOrgDays: 30,
  backupDays: 35,
} as const;
