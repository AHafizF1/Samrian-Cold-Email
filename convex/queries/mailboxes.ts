import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrgAccess } from "../lib/auth";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("mailboxes"),
      _creationTime: v.number(),
      orgId: v.string(),
      name: v.string(),
      smtpHost: v.string(),
      smtpPort: v.number(),
      imapHost: v.string(),
      imapPort: v.number(),
      username: v.string(),
      dailySendLimit: v.number(),
      emailsSentToday: v.number(),
      lastPolledAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const { orgId } = await requireOrgAccess(ctx);

    const mailboxes = await ctx.db
      .query("mailboxes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // Never expose encrypted fields
    return mailboxes.map(({ encryptedCreds, iv, ...safe }) => safe);
  },
});
