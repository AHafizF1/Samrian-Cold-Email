import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrgAccess, verifyCampaignOwnership, verifyContactOwnership } from "../lib/auth";

/**
 * Look up an email thread by its RFC 5322 Message-ID.
 * Used by the polling worker to match inReplyTo headers against sent messages.
 */
export const getByMessageId = query({
  args: { messageId: v.string() },
  handler: async (ctx, args) => {
    // Verify org access — polling worker calls this in a Convex context
    const { orgId } = await requireOrgAccess(ctx);

    const thread = await ctx.db
      .query("emailThreads")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .first();

    if (!thread || thread.orgId !== orgId) {
      return null;
    }

    return thread;
  },
});

export const listByCampaign = query({
  args: {
    campaignId: v.id("campaigns"),
    numItems: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyCampaignOwnership(ctx, args.campaignId);

    const limit = args.numItems ?? 100;
    
    return await ctx.db
      .query("emailThreads")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .paginate({ cursor: args.cursor ?? null, numItems: limit });
  },
});

export const listByContact = query({
  args: {
    contactId: v.id("contacts"),
    numItems: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyContactOwnership(ctx, args.contactId);

    const limit = args.numItems ?? 100;

    return await ctx.db
      .query("emailThreads")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .paginate({ cursor: args.cursor ?? null, numItems: limit });
  },
});
