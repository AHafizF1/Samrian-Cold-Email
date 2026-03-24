import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireOrgAccess, verifyOrgOwnership } from "../lib/auth";
import {
  CONTACT_STATUSES,
  isValidTimestamp,
  isValidContactStatus,
  type ContactStatus,
} from "../lib/validators";

export const assign = mutation({
  args: {
    campaignId: v.id("campaigns"),
    contactId: v.id("contacts"),
  },
  returns: v.id("campaignContacts"),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["update"] });

    // Verify campaign belongs to user's organization
    const campaign = await ctx.db.get(args.campaignId);
    await verifyOrgOwnership(campaign, orgId, "Campaign");

    // Verify contact belongs to user's organization
    const contact = await ctx.db.get(args.contactId);
    await verifyOrgOwnership(contact, orgId, "Contact");

    // Check for duplicate assignment
    const existingAssignment = await ctx.db
      .query("campaignContacts")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("contactId"), args.contactId))
      .first();

    if (existingAssignment) {
      throw new Error("Contact already assigned to this campaign");
    }

    // Create assignment with initial status "active" and currentStep 0
    return await ctx.db.insert("campaignContacts", {
      campaignId: args.campaignId,
      contactId: args.contactId,
      orgId,
      status: "active",
      currentStep: 0,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("campaignContacts"),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["update"] });

    // Verify assignment belongs to user's organization
    const assignment = await ctx.db.get(args.id);
    await verifyOrgOwnership(assignment, orgId, "Assignment");

    // Validate status enum
    if (!isValidContactStatus(args.status)) {
      throw new Error(`Invalid status. Must be one of: ${CONTACT_STATUSES.join(", ")}`);
    }

    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});

export const updateStep = mutation({
  args: {
    id: v.id("campaignContacts"),
    currentStep: v.number(),
    lastEmailSentAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["update"] });

    // Verify assignment belongs to user's organization
    const assignment = await ctx.db.get(args.id);
    await verifyOrgOwnership(assignment, orgId, "Assignment");

    // Validate currentStep is non-negative integer
    if (!Number.isInteger(args.currentStep) || args.currentStep < 0) {
      throw new Error("currentStep must be a non-negative integer");
    }

    // Validate lastEmailSentAt if provided
    if (args.lastEmailSentAt !== undefined && !isValidTimestamp(args.lastEmailSentAt)) {
      throw new Error("lastEmailSentAt must be a valid Unix timestamp");
    }

    const updates: { currentStep: number; lastEmailSentAt?: number } = {
      currentStep: args.currentStep,
    };

    if (args.lastEmailSentAt !== undefined) {
      updates.lastEmailSentAt = args.lastEmailSentAt;
    }

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const bulkAssign = mutation({
  args: {
    campaignId: v.id("campaigns"),
    contactIds: v.array(v.id("contacts")),
  },
  returns: v.object({
    success: v.array(v.id("campaignContacts")),
    errors: v.array(
      v.object({
        index: v.number(),
        error: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["update"] });

    // Verify campaign belongs to user's organization
    const campaign = await ctx.db.get(args.campaignId);
    await verifyOrgOwnership(campaign, orgId, "Campaign");

    const success: Id<"campaignContacts">[] = [];
    const errors: { index: number; error: string }[] = [];

    // Process each contact ID, continuing on errors
    for (let i = 0; i < args.contactIds.length; i++) {
      const contactId = args.contactIds[i];

      try {
        // Verify contact belongs to user's organization
        const contact = await ctx.db.get(contactId);
        await verifyOrgOwnership(contact, orgId, "Contact");

        // Check for duplicate assignment
        const existingAssignment = await ctx.db
          .query("campaignContacts")
          .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
          .filter((q) => q.eq(q.field("contactId"), contactId))
          .first();

        if (existingAssignment) {
          throw new Error("Contact already assigned to this campaign");
        }

        // Create assignment with initial status "active" and currentStep 0
        const assignmentId = await ctx.db.insert("campaignContacts", {
          campaignId: args.campaignId,
          contactId,
          orgId,
          status: "active",
          currentStep: 0,
        });

        success.push(assignmentId);
      } catch (error) {
        // Record the error and continue processing
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { success, errors };
  },
});

export const unassign = mutation({
  args: { id: v.id("campaignContacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["update"] });

    // Verify assignment belongs to user's organization
    const assignment = await ctx.db.get(args.id);
    await verifyOrgOwnership(assignment, orgId, "Assignment");

    // Delete the assignment
    await ctx.db.delete(args.id);
    return null;
  },
});
