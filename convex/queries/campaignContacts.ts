import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrgAccess } from "../lib/auth";

export const listByCampaign = query({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.array(
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
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    // Get all assignments for this campaign
    const assignments = await ctx.db
      .query("campaignContacts")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    // Filter by organization to ensure user can only see their org's data
    return assignments.filter((assignment) => assignment.orgId === orgId);
  },
});

export const listByContact = query({
  args: {
    contactId: v.id("contacts"),
  },
  returns: v.array(
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
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    // Get all assignments for this contact
    const assignments = await ctx.db
      .query("campaignContacts")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .collect();

    // Filter by organization to ensure user can only see their org's data
    return assignments.filter((assignment) => assignment.orgId === orgId);
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
    const { orgId } = await requireOrgAccess(ctx);

    // Find assignment by campaignId and contactId
    const assignment = await ctx.db
      .query("campaignContacts")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("contactId"), args.contactId))
      .first();

    // Verify assignment belongs to user's organization
    if (!assignment || assignment.orgId !== orgId) {
      return null;
    }

    return assignment;
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
    const { orgId } = await requireOrgAccess(ctx);

    // Get all assignments for this campaign
    const assignments = await ctx.db
      .query("campaignContacts")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    // Filter by organization
    const orgAssignments = assignments.filter((assignment) => assignment.orgId === orgId);

    // Calculate counts by status
    const stats = {
      campaignId: args.campaignId,
      total: orgAssignments.length,
      active: 0,
      replied: 0,
      bounced: 0,
      unsubscribed: 0,
      completed: 0,
    };

    for (const assignment of orgAssignments) {
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
