import { v } from "convex/values";
import { mutation, internalMutation, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireOrgAccess, verifyOrgOwnership } from "../lib/auth";
import { rateLimit } from "../lib/rateLimiter";
import { writeAuditLog } from "../lib/auditLog";

export const create = mutation({
  args: {
    name: v.string(),
    provider: v.union(
      v.literal("puzzle"),
      v.literal("mailpool"),
      v.literal("google"),
      v.literal("microsoft")
    ),
    smtpHost: v.optional(v.string()),
    smtpPort: v.optional(v.number()),
    imapHost: v.optional(v.string()),
    imapPort: v.optional(v.number()),
    username: v.optional(v.string()),
    encryptedCreds: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    userEmail: v.optional(v.string()),
    iv: v.string(),
    dailySendLimit: v.number(),
  },
  returns: v.id("mailboxes"),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireOrgAccess(ctx, { mailbox: ["create"] });
    await rateLimit.limit(ctx, "mailbox:create", { key: orgId, throws: true });

    const now = Date.now();
    const id = await ctx.db.insert("mailboxes", {
      orgId,
      name: args.name,
      provider: args.provider,
      smtpHost: args.smtpHost,
      smtpPort: args.smtpPort,
      imapHost: args.imapHost,
      imapPort: args.imapPort,
      username: args.username,
      encryptedCreds: args.encryptedCreds,
      refreshToken: args.refreshToken,
      accessToken: args.accessToken,
      tokenExpiresAt: args.tokenExpiresAt,
      userEmail: args.userEmail,
      iv: args.iv,
      dailySendLimit: args.dailySendLimit,
      emailsSentToday: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      orgId,
      userId: user._id,
      action: "mailbox.create",
      details: `Created mailbox "${args.name}" (${args.provider})`,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("mailboxes"),
    name: v.optional(v.string()),
    smtpHost: v.optional(v.string()),
    smtpPort: v.optional(v.number()),
    imapHost: v.optional(v.string()),
    imapPort: v.optional(v.number()),
    username: v.optional(v.string()),
    encryptedCreds: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    userEmail: v.optional(v.string()),
    iv: v.optional(v.string()),
    dailySendLimit: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { mailbox: ["update"] });
    await rateLimit.limit(ctx, "mailbox:update", { key: orgId, throws: true });

    const mailbox = await ctx.db.get(args.id);
    await verifyOrgOwnership(mailbox, orgId, "Mailbox");

    const { id, ...fields } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("mailboxes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireOrgAccess(ctx, { mailbox: ["delete"] });
    await rateLimit.limit(ctx, "mailbox:delete", { key: orgId, throws: true });

    const mailbox = await ctx.db.get(args.id);
    await verifyOrgOwnership(mailbox, orgId, "Mailbox");

    await ctx.db.delete(args.id);

    await writeAuditLog(ctx, {
      orgId,
      userId: user._id,
      action: "mailbox.delete",
      details: `Deleted mailbox "${mailbox!.name}" (${mailbox!.provider})`,
    });

    return null;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("mailboxes"),
    status: v.union(
      v.literal("active"),
      v.literal("disconnected"),
      v.literal("limit_reached")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireOrgAccess(ctx, { mailbox: ["update"] });

    const mailbox = await ctx.db.get(args.id);
    await verifyOrgOwnership(mailbox, orgId, "Mailbox");

    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });

    await writeAuditLog(ctx, {
      orgId,
      userId: user._id,
      action: "mailbox.status_change",
      details: `Mailbox "${mailbox!.name}" status: ${mailbox!.status} → ${args.status}`,
    });

    return null;
  },
});

export const updateLastPolled = mutation({
  args: { id: v.id("mailboxes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    const mailbox = await ctx.db.get(args.id);
    await verifyOrgOwnership(mailbox, orgId, "Mailbox");

    await ctx.db.patch(args.id, { lastPolledAt: Date.now(), updatedAt: Date.now() });
    return null;
  },
});

export const updateLastSent = mutation({
  args: { id: v.id("mailboxes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    const mailbox = await ctx.db.get(args.id);
    await verifyOrgOwnership(mailbox, orgId, "Mailbox");

    await ctx.db.patch(args.id, {
      lastSuccessfulSendAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const incrementSentToday = mutation({
  args: { id: v.id("mailboxes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx);

    const mailbox = await ctx.db.get(args.id);
    await verifyOrgOwnership(mailbox, orgId, "Mailbox");

    await ctx.db.patch(args.id, {
      emailsSentToday: mailbox!.emailsSentToday + 1,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const resetDailyCountersChunk = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const batch = await ctx.db.query("mailboxes").paginate({
      cursor: args.cursor,
      numItems: 100,
    });

    for (const mailbox of batch.page) {
      await ctx.db.patch(mailbox._id, { emailsSentToday: 0, updatedAt: now });
    }

    return {
      isDone: batch.isDone,
      continueCursor: batch.continueCursor,
    };
  },
});

export const resetDailyCounters = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx: any) => {
    let cursor: string | null = null;
    let isDone = false;

    while (!isDone) {
      const callName = (internal as any)?.mutations?.mailboxes?.resetDailyCountersChunk ?? "mutations/mailboxes:resetDailyCountersChunk";
      const _result: any = await ctx.runMutation(callName, { cursor });
      cursor = _result.continueCursor;
      isDone = _result.isDone;
    }

    return null;
  },
});
