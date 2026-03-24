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

  // Mailboxes — SMTP/IMAP credentials per org
  mailboxes: defineTable({
    orgId: v.string(),
    name: v.string(),
    smtpHost: v.string(),
    smtpPort: v.number(),
    imapHost: v.string(),
    imapPort: v.number(),
    username: v.string(),
    encryptedCreds: v.string(),
    iv: v.string(),
    dailySendLimit: v.number(),
    emailsSentToday: v.number(),
    lastPolledAt: v.number(),
  }).index("by_org", ["orgId"]),

  // Contacts — leads per org
  contacts: defineTable({
    orgId: v.string(),
    email: v.string(),
    customVars: v.any(),
    timezone: v.optional(v.string()),
    bounceStatus: v.optional(v.string()),
  }).index("by_org_email", ["orgId", "email"]),

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
  }).index("by_org", ["orgId"]),

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
    .index("by_org", ["orgId"]),

  // Email threads — tracks sent emails and replies
  emailThreads: defineTable({
    campaignContactId: v.id("campaignContacts"),
    orgId: v.string(),
    messageId: v.string(),
    subject: v.string(),
    body: v.string(),
    sentAt: v.number(),
    mailboxId: v.id("mailboxes"),
    step: v.number(),
  })
    .index("by_campaign_contact", ["campaignContactId"])
    .index("by_message_id", ["messageId"])
    .index("by_org", ["orgId"]),

  // Do-not-contact blocklist
  doNotContact: defineTable({
    orgId: v.string(),
    email: v.string(),
  }).index("by_org_email", ["orgId", "email"]),
});
