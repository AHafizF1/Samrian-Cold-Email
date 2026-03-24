import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireOrgAccess } from "../lib/auth";

export const check = query({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    const entry = await ctx.db
      .query("doNotContact")
      .withIndex("by_org_email", (q) =>
        q.eq("orgId", orgId).eq("email", args.email)
      )
      .first();

    return entry !== null;
  },
});

export const listByOrg = query({
  args: {
    numItems: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("doNotContact"),
        _creationTime: v.number(),
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
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);
    const limit = args.numItems ?? 100;

    return await ctx.db
      .query("doNotContact")
      .withIndex("by_org_email", (q) => q.eq("orgId", orgId))
      .paginate({ cursor: args.cursor ?? null, numItems: limit });
  },
});
