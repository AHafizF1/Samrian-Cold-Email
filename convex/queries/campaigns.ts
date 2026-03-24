import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrgAccess } from "../lib/auth";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("campaigns"),
      _creationTime: v.number(),
      orgId: v.string(),
      name: v.string(),
      status: v.string(),
      schedule: v.object({
        defaultTimezone: v.string(),
        daysAllowed: v.array(v.string()),
        startTime: v.string(),
        endTime: v.string(),
      }),
    })
  ),
  handler: async (ctx) => {
    const { orgId } = await requireOrgAccess(ctx);

    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    return campaigns;
  },
});

export const get = query({
  args: {
    id: v.id("campaigns"),
  },
  returns: v.union(
    v.object({
      _id: v.id("campaigns"),
      _creationTime: v.number(),
      orgId: v.string(),
      name: v.string(),
      status: v.string(),
      schedule: v.object({
        defaultTimezone: v.string(),
        daysAllowed: v.array(v.string()),
        startTime: v.string(),
        endTime: v.string(),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    const campaign = await ctx.db.get(args.id);

    // Verify campaign belongs to user's organization
    if (!campaign || campaign.orgId !== orgId) {
      return null;
    }

    return campaign;
  },
});

export const getByStatus = query({
  args: {
    status: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("campaigns"),
      _creationTime: v.number(),
      orgId: v.string(),
      name: v.string(),
      status: v.string(),
      schedule: v.object({
        defaultTimezone: v.string(),
        daysAllowed: v.array(v.string()),
        startTime: v.string(),
        endTime: v.string(),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // Filter by status
    return campaigns.filter((campaign) => campaign.status === args.status);
  },
});
