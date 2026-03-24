/**
 * Centralized rate limiter configuration (Single Source of Truth)
 *
 * All rate limit policies are defined here. Mutations consume these
 * policies via `rateLimit.limit(ctx, policyName, { key })`.
 *
 * Uses @convex-dev/rate-limiter (Token Bucket / Fixed Window)
 * running directly inside Convex transactions — no Redis, no Upstash.
 */
import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const rateLimit = new RateLimiter(components.rateLimiter, {
  // ── Mailbox CRUD ──────────────────────────────────────────────
  // Admin-only, but still guard against rogue scripts
  "mailbox:create": { kind: "token bucket", rate: 10, period: HOUR, capacity: 5 },
  "mailbox:update": { kind: "token bucket", rate: 30, period: MINUTE, capacity: 5 },
  "mailbox:delete": { kind: "token bucket", rate: 5, period: HOUR, capacity: 2 },

  // ── Campaign CRUD ─────────────────────────────────────────────
  "campaign:create": { kind: "token bucket", rate: 20, period: HOUR, capacity: 5 },
  "campaign:update": { kind: "token bucket", rate: 30, period: MINUTE, capacity: 5 },
  "campaign:delete": { kind: "token bucket", rate: 10, period: HOUR, capacity: 3 },

  // ── Contact CRUD ──────────────────────────────────────────────
  "contact:create": { kind: "token bucket", rate: 60, period: MINUTE, capacity: 10 },
  "contact:bulkCreate": { kind: "fixed window", rate: 10, period: MINUTE },
  "contact:delete": { kind: "token bucket", rate: 30, period: MINUTE, capacity: 5 },

  // ── Campaign Contacts ─────────────────────────────────────────
  "campaignContact:assign": { kind: "token bucket", rate: 60, period: MINUTE, capacity: 10 },
  "campaignContact:bulkAssign": { kind: "fixed window", rate: 10, period: MINUTE },

  // ── Do‑Not‑Contact ────────────────────────────────────────────
  "dnc:add": { kind: "token bucket", rate: 30, period: MINUTE, capacity: 5 },
  "dnc:delete": { kind: "token bucket", rate: 10, period: MINUTE, capacity: 3 },
});
