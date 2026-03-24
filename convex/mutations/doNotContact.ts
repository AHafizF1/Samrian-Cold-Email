import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { requireOrgAccess } from "../lib/auth";
import { rateLimit } from "../lib/rateLimiter";
import { writeAuditLog } from "../lib/auditLog";

export const add = mutation({
  args: {
    email: v.string(),
    reason: v.union(
      v.literal("unsubscribed"),
      v.literal("bounced_hard"),
      v.literal("manual")
    ),
    campaignId: v.optional(v.id("campaigns")),
    unsubscribeToken: v.optional(v.string()),
  },
  returns: v.id("doNotContact"),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireOrgAccess(ctx);
    await rateLimit.limit(ctx, "dnc:add", { key: orgId, throws: true });

    // Idempotency — skip if already on the list
    const existing = await ctx.db
      .query("doNotContact")
      .withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("email", args.email))
      .first();

    if (existing) {
      return existing._id;
    }

    const id = await ctx.db.insert("doNotContact", {
      orgId,
      email: args.email,
      reason: args.reason,
      campaignId: args.campaignId,
      unsubscribeToken: args.unsubscribeToken,
      createdAt: Date.now(),
    });

    await writeAuditLog(ctx, {
      orgId,
      userId: user._id,
      action: "dnc.add",
      details: `Added "${args.email}" to do-not-contact (reason: ${args.reason})`,
    });

    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("doNotContact") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireOrgAccess(ctx);
    await rateLimit.limit(ctx, "dnc:delete", { key: orgId, throws: true });

    const entry = await ctx.db.get(args.id);
    if (!entry || entry.orgId !== orgId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Do-not-contact entry not found",
      });
    }

    await ctx.db.delete(args.id);

    await writeAuditLog(ctx, {
      orgId,
      userId: user._id,
      action: "dnc.remove",
      details: `Removed "${entry.email}" from do-not-contact`,
    });

    return null;
  },
});
