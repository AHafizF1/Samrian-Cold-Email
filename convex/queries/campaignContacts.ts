import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrgAccess, verifyCampaignOwnership, verifyContactOwnership } from "../lib/auth";

export const listByCampaign = query({
  args: {
    campaignId: v.id("campaigns"),
    numItems: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("campaignContacts"),
        _creationTime: v.number(),
        campaignId: v.id("campaigns"),
        contactId: v.id("contacts"),
        orgId: v.string(),
        status: v.string(),
        currentStep: v.number(),
        lastEmailSentAt: v.optional(v.number()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await verifyCampaignOwnership(ctx, args.campaignId);

    const limit = args.numItems ?? 100;

    return await ctx.db
      .query("campaignContacts")
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
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("campaignContacts"),
        _creationTime: v.number(),
        campaignId: v.id("campaigns"),
        contactId: v.id("contacts"),
        orgId: v.string(),
        status: v.string(),
        currentStep: v.number(),
        lastEmailSentAt: v.optional(v.number()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await verifyContactOwnership(ctx, args.contactId);

    const limit = args.numItems ?? 100;

    return await ctx.db
      .query("campaignContacts")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .paginate({ cursor: args.cursor ?? null, numItems: limit });
  },
});

export const getAssignment = query({
  args: {
    campaignId: v.id("campaigns"),
    contactId: v.id("contacts"),
  },
  returns: v.union(
    v.object({
      _id: v.id("campaignContacts"),
      _creationTime: v.number(),
      campaignId: v.id("campaigns"),
      contactId: v.id("contacts"),
      orgId: v.string(),
      status: v.string(),
      currentStep: v.number(),
      lastEmailSentAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Only verify contact to verify Org scope.
    await verifyContactOwnership(ctx, args.contactId);

    // Find assignment by compound index
    const assignment = await ctx.db
      .query("campaignContacts")
      .withIndex("by_contact_campaign", (q) =>
        q.eq("contactId", args.contactId).eq("campaignId", args.campaignId)
      )
      .first();

    return assignment ?? null;
  },
});

export const getCampaignStats = query({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.object({
    campaignId: v.id("campaigns"),
    total: v.number(),
    active: v.number(),
    replied: v.number(),
    bounced: v.number(),
    unsubscribed: v.number(),
    completed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Verify campaign belongs to the org
    await verifyCampaignOwnership(ctx, args.campaignId);

    // Get all assignments for this specific campaign
    const assignments = await ctx.db
      .query("campaignContacts")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    // Calculate counts directly
    const stats = {
      campaignId: args.campaignId,
      total: assignments.length,
      active: 0,
      replied: 0,
      bounced: 0,
      unsubscribed: 0,
      completed: 0,
    };

    for (const assignment of assignments) {
      switch (assignment.status) {
        case "active":
          stats.active++;
          break;
        case "replied":
          stats.replied++;
          break;
        case "bounced":
          stats.bounced++;
          break;
        case "unsubscribed":
          stats.unsubscribed++;
          break;
        case "completed":
          stats.completed++;
          break;
      }
    }

    return stats;
  },
});
