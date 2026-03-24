import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireOrgAccess, verifyOrgOwnership, cascadeDeleteAssignments } from "../lib/auth";
import {
  CAMPAIGN_STATUSES,
  VALID_DAYS,
  isValidTimezone,
  isValidTimeFormat,
  isStartBeforeEnd,
  isValidCampaignStatus,
  isValidDay,
  type CampaignStatus,
} from "../lib/validators";

// Schedule validator
const scheduleValidator = v.object({
  defaultTimezone: v.string(),
  daysAllowed: v.array(v.string()),
  startTime: v.string(),
  endTime: v.string(),
});

export const create = mutation({
  args: {
    name: v.string(),
    status: v.string(),
    schedule: scheduleValidator,
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["create"] });

    // Validate name length
    if (args.name.length < 1 || args.name.length > 200) {
      throw new Error("Campaign name must be between 1 and 200 characters");
    }

    // Validate status enum
    if (!isValidCampaignStatus(args.status)) {
      throw new Error(`Invalid status. Must be one of: ${CAMPAIGN_STATUSES.join(", ")}`);
    }

    // Validate timezone
    if (!isValidTimezone(args.schedule.defaultTimezone)) {
      throw new Error(`Invalid timezone: ${args.schedule.defaultTimezone}`);
    }

    // Validate daysAllowed
    if (args.schedule.daysAllowed.length === 0) {
      throw new Error("Schedule must have at least one allowed day");
    }

    for (const day of args.schedule.daysAllowed) {
      if (!isValidDay(day)) {
        throw new Error(`Invalid day: ${day}. Must be one of: ${VALID_DAYS.join(", ")}`);
      }
    }

    // Validate time format
    if (!isValidTimeFormat(args.schedule.startTime)) {
      throw new Error(`Invalid startTime format: ${args.schedule.startTime}. Must be HH:MM`);
    }

    if (!isValidTimeFormat(args.schedule.endTime)) {
      throw new Error(`Invalid endTime format: ${args.schedule.endTime}. Must be HH:MM`);
    }

    // Validate startTime < endTime
    if (!isStartBeforeEnd(args.schedule.startTime, args.schedule.endTime)) {
      throw new Error("startTime must be before endTime");
    }

    return await ctx.db.insert("campaigns", {
      orgId,
      name: args.name,
      status: args.status,
      schedule: args.schedule,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("campaigns"),
    name: v.optional(v.string()),
    schedule: v.optional(scheduleValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["update"] });

    // Verify campaign belongs to user's organization
    const campaign = await ctx.db.get(args.id);
    await verifyOrgOwnership(campaign, orgId, "Campaign");

    const updates: Partial<{
      name: string;
      schedule: typeof args.schedule;
    }> = {};

    // Validate and add name if provided
    if (args.name !== undefined) {
      if (args.name.length < 1 || args.name.length > 200) {
        throw new Error("Campaign name must be between 1 and 200 characters");
      }
      updates.name = args.name;
    }

    // Validate and add schedule if provided
    if (args.schedule !== undefined) {
      // Validate timezone
      if (!isValidTimezone(args.schedule.defaultTimezone)) {
        throw new Error(`Invalid timezone: ${args.schedule.defaultTimezone}`);
      }

      // Validate daysAllowed
      if (args.schedule.daysAllowed.length === 0) {
        throw new Error("Schedule must have at least one allowed day");
      }

      for (const day of args.schedule.daysAllowed) {
        if (!isValidDay(day)) {
          throw new Error(`Invalid day: ${day}. Must be one of: ${VALID_DAYS.join(", ")}`);
        }
      }

      // Validate time format
      if (!isValidTimeFormat(args.schedule.startTime)) {
        throw new Error(`Invalid startTime format: ${args.schedule.startTime}. Must be HH:MM`);
      }

      if (!isValidTimeFormat(args.schedule.endTime)) {
        throw new Error(`Invalid endTime format: ${args.schedule.endTime}. Must be HH:MM`);
      }

      // Validate startTime < endTime
      if (!isStartBeforeEnd(args.schedule.startTime, args.schedule.endTime)) {
        throw new Error("startTime must be before endTime");
      }

      updates.schedule = args.schedule;
    }

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("campaigns"),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["update"] });

    // Verify campaign belongs to user's organization
    const campaign = await ctx.db.get(args.id);
    await verifyOrgOwnership(campaign, orgId, "Campaign");

    // Validate status enum
    if (!isValidCampaignStatus(args.status)) {
      throw new Error(`Invalid status. Must be one of: ${CAMPAIGN_STATUSES.join(", ")}`);
    }

    // Validate status transitions
    const currentStatus = campaign!.status;
    const newStatus = args.status;

    // Define invalid transitions
    const invalidTransitions: Record<string, string[]> = {
      completed: ["draft", "active", "paused"], // completed cannot transition to anything
    };

    if (invalidTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }

    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("campaigns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["delete"] });

    // Verify campaign belongs to user's organization
    const campaign = await ctx.db.get(args.id);
    await verifyOrgOwnership(campaign, orgId, "Campaign");

    // Cascade delete: remove all campaignContacts associated with this campaign
    await cascadeDeleteAssignments(ctx, "campaign", args.id);

    // Delete the campaign
    await ctx.db.delete(args.id);
    return null;
  },
});
