import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================
// APP SCHEMA — Business tables only.
// Auth tables (user, session, account, verification, organization, member, invitation)
// are managed by the Better Auth component in convex/betterAuth/.
// ============================================================

export default defineSchema({
  // Per-org settings (encrypted API keys, etc.)
  orgSettings: defineTable({
    orgId: v.string(),
    encryptedMailpoolKey: v.optional(v.string()),
    iv: v.optional(v.string()),
  }).index("by_org", ["orgId"]),

  // Audit log for SOC2 compliance
  auditLogs: defineTable({
    orgId: v.string(),
    userId: v.string(),
    action: v.string(),
    details: v.string(),
    timestamp: v.number(),
  }).index("by_org", ["orgId"]),

  // Mailboxes — email provider credentials per org
  mailboxes: defineTable({
    orgId: v.string(),
    name: v.string(),
    provider: v.union(
      v.literal("puzzle"),
      v.literal("mailpool"),
      v.literal("google"),
      v.literal("microsoft")
    ),

    // Provider-managed fields (SMTP/IMAP) — optional for OAuth2 providers
    smtpHost: v.optional(v.string()),
    smtpPort: v.optional(v.number()),
    imapHost: v.optional(v.string()),
    imapPort: v.optional(v.number()),
    username: v.optional(v.string()),
    encryptedCreds: v.optional(v.string()),

    // OAuth2 fields (Google/Microsoft)
    refreshToken: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    userEmail: v.optional(v.string()),

    // Shared encryption IV
    iv: v.string(),

    // Rate limiting
    dailySendLimit: v.number(),
    emailsSentToday: v.number(),

    // Health monitoring
    status: v.union(
      v.literal("active"),
      v.literal("disconnected"),
      v.literal("limit_reached")
    ),
    lastPolledAt: v.optional(v.number()),
    lastSuccessfulSendAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_status", ["status"])
    .index("by_org_status", ["orgId", "status"]),

  // Contacts — leads per org
  contacts: defineTable({
    orgId: v.string(),
    email: v.string(),
    customVars: v.any(),
    timezone: v.optional(v.string()),
    bounceStatus: v.optional(v.string()),
  })
    .index("by_org_email", ["orgId", "email"])
    .searchIndex("search_email", {
      searchField: "email",
      filterFields: ["orgId"],
    }),

  // Campaigns — cold email sequences per org
  campaigns: defineTable({
    orgId: v.string(),
    name: v.string(),
    status: v.string(), // "draft" | "active" | "paused" | "completed"
    schedule: v.object({
      defaultTimezone: v.string(),
      daysAllowed: v.array(v.string()),
      startTime: v.string(),
      endTime: v.string(),
    }),
    steps: v.array(
      v.object({
        subject: v.string(),
        body: v.string(),
      })
    ),
  })
    .index("by_org", ["orgId"])
    .index("by_org_status", ["orgId", "status"]),

  // Campaign contacts — tracks which contacts are in which campaigns
  campaignContacts: defineTable({
    campaignId: v.id("campaigns"),
    contactId: v.id("contacts"),
    orgId: v.string(),
    status: v.string(), // "active" | "replied" | "bounced" | "unsubscribed" | "completed"
    currentStep: v.number(),
    lastEmailSentAt: v.optional(v.number()),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_contact", ["contactId"])
    .index("by_org", ["orgId"])
    .index("by_contact_campaign", ["contactId", "campaignId"]),

  // Email threads — tracks sent emails and replies
  emailThreads: defineTable({
    orgId: v.string(),
    campaignId: v.id("campaigns"),
    contactId: v.id("contacts"),
    mailboxId: v.id("mailboxes"),

    messageId: v.string(), // RFC 5322 Message-ID
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),

    direction: v.union(v.literal("sent"), v.literal("received")),

    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    textBody: v.optional(v.string()),
    htmlBody: v.optional(v.string()),

    headers: v.any(), // Full email headers
    emlFileId: v.optional(v.id("_storage")),

    sentAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_contact", ["contactId"])
    .index("by_message_id", ["messageId"]),

  // Do-not-contact blocklist
  doNotContact: defineTable({
    orgId: v.string(),
    email: v.string(),
    reason: v.union(
      v.literal("unsubscribed"),
      v.literal("bounced_hard"),
      v.literal("manual")
    ),
    campaignId: v.optional(v.id("campaigns")),
    unsubscribeToken: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org_email", ["orgId", "email"])
    .index("by_email", ["email"]),
});
