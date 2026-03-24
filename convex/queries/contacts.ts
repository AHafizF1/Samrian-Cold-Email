import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrgAccess } from "../lib/auth";

export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    contacts: v.array(
      v.object({
        _id: v.id("contacts"),
        _creationTime: v.number(),
        orgId: v.string(),
        email: v.string(),
        customVars: v.any(),
        timezone: v.optional(v.string()),
        bounceStatus: v.optional(v.string()),
      })
    ),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    const limit = args.limit ?? 100;

    // Build query with pagination
    const results = await ctx.db
      .query("contacts")
      .withIndex("by_org_email", (q) => q.eq("orgId", orgId))
      .paginate({
        cursor: args.cursor ?? null,
        numItems: limit,
      });

    return {
      contacts: results.page,
      cursor: results.continueCursor,
    };
  },
});

export const get = query({
  args: {
    id: v.id("contacts"),
  },
  returns: v.union(
    v.object({
      _id: v.id("contacts"),
      _creationTime: v.number(),
      orgId: v.string(),
      email: v.string(),
      customVars: v.any(),
      timezone: v.optional(v.string()),
      bounceStatus: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    const contact = await ctx.db.get(args.id);

    // Verify contact belongs to user's organization
    if (!contact || contact.orgId !== orgId) {
      return null;
    }

    return contact;
  },
});

export const getByEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("contacts"),
      _creationTime: v.number(),
      orgId: v.string(),
      email: v.string(),
      customVars: v.any(),
      timezone: v.optional(v.string()),
      bounceStatus: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    // Use by_org_email index for efficient lookup
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("email", args.email))
      .first();

    return contact ?? null;
  },
});

export const search = query({
  args: {
    query: v.string(),
    numItems: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("contacts"),
        _creationTime: v.number(),
        orgId: v.string(),
        email: v.string(),
        customVars: v.any(),
        timezone: v.optional(v.string()),
        bounceStatus: v.optional(v.string()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    const limit = args.numItems ?? 100;

    // Use native search index with orgId scoped filter
    return await ctx.db
      .query("contacts")
      .withSearchIndex("search_email", (q) =>
        q.search("email", args.query).eq("orgId", orgId)
      )
      .paginate({ cursor: args.cursor ?? null, numItems: limit });
  },
});
