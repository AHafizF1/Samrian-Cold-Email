import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireOrgAccess, verifyOrgOwnership, cascadeDeleteAssignments } from "../lib/auth";
import { rateLimit } from "../lib/rateLimiter";
import { writeAuditLog } from "../lib/auditLog";
import {
  CAMPAIGN_STATUSES,
  VALID_DAYS,
  isValidTimezone,
  isValidTimeFormat,
  isStartBeforeEnd,
  isValidCampaignStatus,
  isValidDay,
} from "../lib/validators";

// ── Shared Validators (DRY) ──────────────────────────────────────
const scheduleValidator = v.object({
  defaultTimezone: v.string(),
  daysAllowed: v.array(v.string()),
  startTime: v.string(),
  endTime: v.string(),
});

const stepsValidator = v.array(
  v.object({
    subject: v.string(),
    body: v.string(),
  })
);

type ScheduleInput = {
  defaultTimezone: string;
  daysAllowed: string[];
  startTime: string;
  endTime: string;
};

/**
 * Validate a campaign schedule object.
 * Extracted to avoid duplicating the same 15-line block in create + update.
 */
function validateSchedule(schedule: ScheduleInput): void {
  if (!isValidTimezone(schedule.defaultTimezone)) {
    throw new Error(`Invalid timezone: ${schedule.defaultTimezone}`);
  }

  if (schedule.daysAllowed.length === 0) {
    throw new Error("Schedule must have at least one allowed day");
  }

  for (const day of schedule.daysAllowed) {
    if (!isValidDay(day)) {
      throw new Error(`Invalid day: ${day}. Must be one of: ${VALID_DAYS.join(", ")}`);
    }
  }

  if (!isValidTimeFormat(schedule.startTime)) {
    throw new Error(`Invalid startTime format: ${schedule.startTime}. Must be HH:MM`);
  }

  if (!isValidTimeFormat(schedule.endTime)) {
    throw new Error(`Invalid endTime format: ${schedule.endTime}. Must be HH:MM`);
  }

  if (!isStartBeforeEnd(schedule.startTime, schedule.endTime)) {
    throw new Error("startTime must be before endTime");
  }
}

/**
 * Validate campaign steps array.
 */
function validateSteps(steps: Array<{ subject: string; body: string }>): void {
  if (steps.length === 0) {
    throw new Error("Campaign must have at least one step");
  }

  for (const [index, step] of steps.entries()) {
    if (!step.subject.trim() || !step.body.trim()) {
      throw new Error(`Step ${index + 1} must have a subject and body`);
    }
  }
}

// ── Mutations ────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    status: v.string(),
    schedule: scheduleValidator,
    steps: stepsValidator,
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireOrgAccess(ctx, { campaign: ["create"] });
    await rateLimit.limit(ctx, "campaign:create", { key: orgId, throws: true });

    if (args.name.length < 1 || args.name.length > 200) {
      throw new Error("Campaign name must be between 1 and 200 characters");
    }

    if (!isValidCampaignStatus(args.status)) {
      throw new Error(`Invalid status. Must be one of: ${CAMPAIGN_STATUSES.join(", ")}`);
    }

    validateSchedule(args.schedule);
    validateSteps(args.steps);

    const id = await ctx.db.insert("campaigns", {
      orgId,
      name: args.name,
      status: args.status,
      schedule: args.schedule,
      steps: args.steps,
    });

    await writeAuditLog(ctx, {
      orgId,
      userId: user._id,
      action: "campaign.create",
      details: `Created campaign "${args.name}" with ${args.steps.length} step(s)`,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("campaigns"),
    name: v.optional(v.string()),
    schedule: v.optional(scheduleValidator),
    steps: v.optional(stepsValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["update"] });
    await rateLimit.limit(ctx, "campaign:update", { key: orgId, throws: true });

    const campaign = await ctx.db.get(args.id);
    await verifyOrgOwnership(campaign, orgId, "Campaign");

    const updates: Partial<{
      name: string;
      schedule: typeof args.schedule;
      steps: typeof args.steps;
    }> = {};

    if (args.name !== undefined) {
      if (args.name.length < 1 || args.name.length > 200) {
        throw new Error("Campaign name must be between 1 and 200 characters");
      }
      updates.name = args.name;
    }

    if (args.schedule !== undefined) {
      validateSchedule(args.schedule);
      updates.schedule = args.schedule;
    }

    if (args.steps !== undefined) {
      validateSteps(args.steps);
      updates.steps = args.steps;
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
    const { user, orgId } = await requireOrgAccess(ctx, { campaign: ["update"] });

    const campaign = await ctx.db.get(args.id);
    await verifyOrgOwnership(campaign, orgId, "Campaign");

    if (!isValidCampaignStatus(args.status)) {
      throw new Error(`Invalid status. Must be one of: ${CAMPAIGN_STATUSES.join(", ")}`);
    }

    const currentStatus = campaign!.status;
    const invalidTransitions: Record<string, string[]> = {
      completed: ["draft", "active", "paused"],
    };

    if (invalidTransitions[currentStatus]?.includes(args.status)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${args.status}`);
    }

    await ctx.db.patch(args.id, { status: args.status });

    await writeAuditLog(ctx, {
      orgId,
      userId: user._id,
      action: "campaign.status_change",
      details: `Campaign "${campaign!.name}" status: ${currentStatus} → ${args.status}`,
    });

    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("campaigns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireOrgAccess(ctx, { campaign: ["delete"] });
    await rateLimit.limit(ctx, "campaign:delete", { key: orgId, throws: true });

    const campaign = await ctx.db.get(args.id);
    await verifyOrgOwnership(campaign, orgId, "Campaign");

    await cascadeDeleteAssignments(ctx, "campaign", args.id);
    await ctx.db.delete(args.id);

    await writeAuditLog(ctx, {
      orgId,
      userId: user._id,
      action: "campaign.delete",
      details: `Deleted campaign "${campaign!.name}"`,
    });

    return null;
  },
});
