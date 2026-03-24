import { v, ConvexError } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireOrgAccess, verifyOrgOwnership, cascadeDeleteAssignments } from "../lib/auth";
import { rateLimit } from "../lib/rateLimiter";
import { writeAuditLog } from "../lib/auditLog";
import {
  CONTACT_STATUSES,
  BOUNCE_STATUSES,
  isValidTimezone,
  isValidEmail,
  isValidCustomVars,
  isValidContactStatus,
  isValidBounceStatus,
  type ContactStatus,
  type BounceStatus,
} from "../lib/validators";

export const create = mutation({
  args: {
    email: v.string(),
    customVars: v.optional(v.any()),
    timezone: v.optional(v.string()),
    bounceStatus: v.optional(v.string()),
  },
  returns: v.id("contacts"),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { contact: ["create"] });
    await rateLimit.limit(ctx, "contact:create", { key: orgId, throws: true });

    // Validate email format
    if (!isValidEmail(args.email)) {
      throw new Error(`Invalid email format: ${args.email}`);
    }

    // Check email uniqueness within organization
    const existingContact = await ctx.db
      .query("contacts")
      .withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("email", args.email))
      .first();

    if (existingContact) {
      throw new Error(`Contact with email ${args.email} already exists in organization`);
    }

    // Validate customVars if provided
    const customVars = args.customVars ?? {};
    if (!isValidCustomVars(customVars)) {
      throw new Error("customVars must be an object with string key-value pairs");
    }

    // Validate timezone if provided
    if (args.timezone !== undefined && !isValidTimezone(args.timezone)) {
      throw new Error(`Invalid timezone: ${args.timezone}`);
    }

    // Validate bounceStatus if provided
    if (args.bounceStatus !== undefined && !isValidBounceStatus(args.bounceStatus)) {
      throw new Error(`Invalid bounceStatus. Must be one of: ${BOUNCE_STATUSES.join(", ")}`);
    }

    return await ctx.db.insert("contacts", {
      orgId,
      email: args.email,
      customVars,
      timezone: args.timezone,
      bounceStatus: args.bounceStatus,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("contacts"),
    email: v.optional(v.string()),
    customVars: v.optional(v.any()),
    timezone: v.optional(v.string()),
    bounceStatus: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { contact: ["update"] });

    // Verify contact belongs to user's organization
    const contact = await ctx.db.get(args.id);
    await verifyOrgOwnership(contact, orgId, "Contact");

    const updates: Partial<{
      email: string;
      customVars: any;
      timezone: string | undefined;
      bounceStatus: string | undefined;
    }> = {};

    // Validate and add email if provided
    if (args.email !== undefined) {
      if (!isValidEmail(args.email)) {
        throw new Error(`Invalid email format: ${args.email}`);
      }

      // Check email uniqueness within organization (excluding current contact)
      const existingContact = await ctx.db
        .query("contacts")
        .withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("email", args.email!))
        .first();

      if (existingContact && existingContact._id !== args.id) {
        throw new Error(`Contact with email ${args.email} already exists in organization`);
      }

      updates.email = args.email;
    }

    // Validate and add customVars if provided
    if (args.customVars !== undefined) {
      if (!isValidCustomVars(args.customVars)) {
        throw new Error("customVars must be an object with string key-value pairs");
      }
      updates.customVars = args.customVars;
    }

    // Validate and add timezone if provided
    if (args.timezone !== undefined) {
      if (args.timezone !== null && !isValidTimezone(args.timezone)) {
        throw new Error(`Invalid timezone: ${args.timezone}`);
      }
      updates.timezone = args.timezone;
    }

    // Validate and add bounceStatus if provided
    if (args.bounceStatus !== undefined) {
      if (args.bounceStatus !== null && !isValidBounceStatus(args.bounceStatus)) {
        throw new Error(`Invalid bounceStatus. Must be one of: ${BOUNCE_STATUSES.join(", ")}`);
      }
      updates.bounceStatus = args.bounceStatus;
    }

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("contacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireOrgAccess(ctx, { contact: ["delete"] });
    await rateLimit.limit(ctx, "contact:delete", { key: orgId, throws: true });

    // Verify contact belongs to user's organization
    const contact = await ctx.db.get(args.id);
    await verifyOrgOwnership(contact, orgId, "Contact");

    // Cascade delete: remove all campaignContacts associated with this contact
    await cascadeDeleteAssignments(ctx, "contact", args.id);

    // Delete the contact
    await ctx.db.delete(args.id);

    await writeAuditLog(ctx, {
      orgId,
      userId: user._id,
      action: "contact.delete",
      details: `Deleted contact "${contact!.email}"`,
    });

    return null;
  },
});

export const bulkCreate = mutation({
  args: {
    contacts: v.array(
      v.object({
        email: v.string(),
        customVars: v.optional(v.any()),
        timezone: v.optional(v.string()),
        bounceStatus: v.optional(v.string()),
      })
    ),
  },
  returns: v.object({
    success: v.array(v.id("contacts")),
    errors: v.array(
      v.object({
        index: v.number(),
        error: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireOrgAccess(ctx, { contact: ["import"] });
    await rateLimit.limit(ctx, "contact:bulkCreate", { key: orgId, throws: true });

    const MAX_BATCH_SIZE = 500;
    if (args.contacts.length > MAX_BATCH_SIZE) {
      throw new ConvexError({
        code: "PAYLOAD_TOO_LARGE",
        message: `bulkCreate is limited to ${MAX_BATCH_SIZE} contacts per request to avoid transaction timeouts.`,
      });
    }

    const success: Id<"contacts">[] = [];
    const errors: { index: number; error: string }[] = [];

    // Process each contact, continuing on errors
    for (let i = 0; i < args.contacts.length; i++) {
      const contactData = args.contacts[i];

      try {
        // Validate email format
        if (!isValidEmail(contactData.email)) {
          throw new ConvexError(`Invalid email format: ${contactData.email}`);
        }

        // Check email uniqueness within organization
        const existingContact = await ctx.db
          .query("contacts")
          .withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("email", contactData.email))
          .first();

        if (existingContact) {
          throw new ConvexError(`Contact with email ${contactData.email} already exists in organization`);
        }

        // Validate customVars if provided
        const customVars = contactData.customVars ?? {};
        if (!isValidCustomVars(customVars)) {
          throw new ConvexError("customVars must be an object with string key-value pairs");
        }

        // Validate timezone if provided
        if (contactData.timezone !== undefined && !isValidTimezone(contactData.timezone)) {
          throw new ConvexError(`Invalid timezone: ${contactData.timezone}`);
        }

        // Validate bounceStatus if provided
        if (
          contactData.bounceStatus !== undefined &&
          !isValidBounceStatus(contactData.bounceStatus)
        ) {
          throw new ConvexError(`Invalid bounceStatus. Must be one of: ${BOUNCE_STATUSES.join(", ")}`);
        }

        // Insert the contact
        const contactId = await ctx.db.insert("contacts", {
          orgId,
          email: contactData.email,
          customVars,
          timezone: contactData.timezone,
          bounceStatus: contactData.bounceStatus,
        });

        success.push(contactId);
      } catch (error: any) {
        // Record the error and continue processing
        errors.push({
          index: i,
          error: error instanceof ConvexError ? (error.data as any).message ?? String(error.data) : error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Write audit log if any contacts were created
    if (success.length > 0) {
      await writeAuditLog(ctx, {
        orgId,
        userId: user._id,
        action: "contact.bulk_create",
        details: `Imported ${success.length} contacts (${errors.length} failed)`,
      });
    }

    return { success, errors };
  },
});

/**
 * System-level mutation for the bounce processing worker.
 * Updates a contact's bounceStatus to "soft" or "hard".
 */
export const updateBounceStatus = internalMutation({
  args: {
    id: v.id("contacts"),
    bounceStatus: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!isValidBounceStatus(args.bounceStatus)) {
      throw new Error(`Invalid bounceStatus. Must be one of: ${BOUNCE_STATUSES.join(", ")}`);
    }

    const contact = await ctx.db.get(args.id);
    if (!contact) {
      throw new Error(`Contact ${args.id} not found`);
    }

    await ctx.db.patch(args.id, { bounceStatus: args.bounceStatus });
    return null;
  },
});
