import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireOrgAccess } from "../lib/auth";

export const create = mutation({
  args: {
    name: v.string(),
    smtpHost: v.string(),
    smtpPort: v.number(),
    imapHost: v.string(),
    imapPort: v.number(),
    username: v.string(),
    encryptedCreds: v.string(),
    iv: v.string(),
    dailySendLimit: v.number(),
  },
  returns: v.id("mailboxes"),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { mailbox: ["create"] });

    return await ctx.db.insert("mailboxes", {
      orgId,
      name: args.name,
      smtpHost: args.smtpHost,
      smtpPort: args.smtpPort,
      imapHost: args.imapHost,
      imapPort: args.imapPort,
      username: args.username,
      encryptedCreds: args.encryptedCreds,
      iv: args.iv,
      dailySendLimit: args.dailySendLimit,
      emailsSentToday: 0,
      lastPolledAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("mailboxes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, { mailbox: ["delete"] });
    await ctx.db.delete(args.id);
    return null;
  },
});
