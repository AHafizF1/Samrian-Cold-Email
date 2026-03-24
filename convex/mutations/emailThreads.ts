import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { requireOrgAccess } from "../lib/auth";

/**
 * Insert a sent/received email into emailThreads — idempotent on messageId.
 * Returns the existing id if the messageId already exists, otherwise inserts.
 */
export const insertEmail = internalMutation({
  args: {
    orgId: v.string(),
    campaignId: v.id("campaigns"),
    contactId: v.id("contacts"),
    mailboxId: v.id("mailboxes"),
    messageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    direction: v.union(v.literal("sent"), v.literal("received")),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    textBody: v.optional(v.string()),
    htmlBody: v.optional(v.string()),
    headers: v.any(),
    sentAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
  },
  returns: v.id("emailThreads"),
  handler: async (ctx, args) => {
    // Idempotency check — skip if messageId already recorded
    const existing = await ctx.db
      .query("emailThreads")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("emailThreads", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("emailThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    const thread = await ctx.db.get(args.id);
    if (!thread || thread.orgId !== orgId) {
      throw new Error("Email thread not found");
    }

    await ctx.db.delete(args.id);
    return null;
  },
});
