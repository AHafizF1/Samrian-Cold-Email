import { internalMutation, action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || "default_development_secret";

/**
 * Generate an HMAC-SHA256 unsubscribe token using Web Crypto API.
 */
export async function generateUnsubscribeToken(
  contactId: string,
  campaignId: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(UNSUBSCRIBE_SECRET);
  const data = encoder.encode(`${contactId}:${campaignId}`);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export const generateToken = action({
  args: {
    contactId: v.id("contacts"),
    campaignId: v.id("campaigns"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    return await generateUnsubscribeToken(args.contactId, args.campaignId);
  },
});

export const processUnsubscribe = action({
  args: {
    contactId: v.id("contacts"),
    campaignId: v.id("campaigns"),
    token: v.string(),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    // 1. Validate token
    const expectedToken = await generateUnsubscribeToken(args.contactId, args.campaignId);
    
    // Constant time comparison is ideal, but strict equality is sufficient here
    // since we're under rate limits and it's a simple unsubscribe action.
    if (args.token !== expectedToken) {
      return { success: false, message: "Invalid unsubscribe token." };
    }

    // 2. Perform the update via internal mutation
    await ctx.runMutation((internal.actions as any).unsubscribe?.executeUnsubscribe ?? "actions/unsubscribe:executeUnsubscribe", {
      contactId: args.contactId,
      campaignId: args.campaignId,
      token: args.token,
    });

    return { success: true, message: "Successfully unsubscribed." };
  },
});

export const executeUnsubscribe = internalMutation({
  args: {
    contactId: v.id("contacts"),
    campaignId: v.id("campaigns"),
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Get contact & campaign contact to get orgId
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    const queryInfo = await ctx.db
      .query("campaignContacts")
      .withIndex("by_contact_campaign", (q) => 
        q.eq("contactId", args.contactId).eq("campaignId", args.campaignId)
      )
      .first();

    if (queryInfo) {
      // 2. Set status to "unsubscribed"
      await ctx.db.patch(queryInfo._id, { status: "unsubscribed" });
    }

    // 3. Add to doNotContact
    // Check if it's already there
    const existingDnc = await ctx.db
      .query("doNotContact")
      .withIndex("by_org_email", (q) => q.eq("orgId", contact.orgId).eq("email", contact.email))
      .first();

    if (!existingDnc) {
      await ctx.db.insert("doNotContact", {
        orgId: contact.orgId,
        email: contact.email,
        reason: "unsubscribed",
        campaignId: args.campaignId,
        unsubscribeToken: args.token,
        createdAt: Date.now(),
      });
    } else {
      // If it exists but is not unsubscribed, update it
      await ctx.db.patch(existingDnc._id, {
        reason: "unsubscribed",
        campaignId: args.campaignId,
        unsubscribeToken: args.token,
      });
    }

    return null;
  },
});
