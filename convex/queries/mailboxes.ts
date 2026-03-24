import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrgAccess, verifyMailboxOwnership } from "../lib/auth";
import { ConvexError } from "convex/values";

// Validator for a sanitized mailbox (no secrets)
const mailboxValidator = v.object({
  _id: v.id("mailboxes"),
  _creationTime: v.number(),
  orgId: v.string(),
  name: v.string(),
  provider: v.union(
    v.literal("puzzle"),
    v.literal("mailpool"),
    v.literal("google"),
    v.literal("microsoft")
  ),
  smtpHost: v.optional(v.string()),
  smtpPort: v.optional(v.number()),
  imapHost: v.optional(v.string()),
  imapPort: v.optional(v.number()),
  username: v.optional(v.string()),
  userEmail: v.optional(v.string()),
  tokenExpiresAt: v.optional(v.number()),
  dailySendLimit: v.number(),
  emailsSentToday: v.number(),
  status: v.union(
    v.literal("active"),
    v.literal("disconnected"),
    v.literal("limit_reached")
  ),
  lastPolledAt: v.optional(v.number()),
  lastSuccessfulSendAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

// Sensitive fields that must never be returned to clients
const SENSITIVE_FIELDS = ["encryptedCreds", "refreshToken", "accessToken", "iv"] as const;

type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

function stripSensitiveFields<T extends Record<string, any>>(
  mailbox: T
): Omit<T, SensitiveField> {
  const result = { ...mailbox };
  for (const field of SENSITIVE_FIELDS) {
    if (field in result) {
      delete result[field];
    }
  }
  return result as Omit<T, SensitiveField>;
}

export const list = query({
  args: {},
  returns: v.array(mailboxValidator),
  handler: async (ctx) => {
    const { orgId } = await requireOrgAccess(ctx);

    const mailboxes = await ctx.db
      .query("mailboxes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    return mailboxes.map((m) => stripSensitiveFields(m) as any);
  },
});

export const get = query({
  args: { id: v.id("mailboxes") },
  returns: v.union(mailboxValidator, v.null()),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    const mailbox = await ctx.db.get(args.id);
    if (!mailbox || mailbox.orgId !== orgId) {
      return null;
    }

    return stripSensitiveFields(mailbox) as any;
  },
});

export const listActive = query({
  args: {},
  returns: v.array(mailboxValidator),
  handler: async (ctx) => {
    const { orgId } = await requireOrgAccess(ctx);

    // Optimized: using compound index (orgId + status)
    const mailboxes = await ctx.db
      .query("mailboxes")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "active"))
      .collect();

    return mailboxes.map((m) => stripSensitiveFields(m) as any);
  },
});


