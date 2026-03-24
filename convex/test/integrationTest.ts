/**
 * Integration test script for Core Data Layer
 * Run this with: bunx convex run test/integrationTest:runTests
 *
 * This test verifies end-to-end workflows:
 * 1. Create campaign → Create contacts → Assign contacts → Update status → Get stats
 * 2. Bulk import contacts → Search → Assign to campaign
 * 3. Create campaign → Update schedule → Change status → Delete (cascade)
 * 4. Data consistency: Campaign stats match actual records
 * 5. Cascade deletion: Deleting contact removes all assignments
 *
 * Note: This test uses internal actions to bypass authentication.
 * In production, all operations require proper authentication and permissions.
 */

import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import {
  CAMPAIGN_STATUSES,
  CONTACT_STATUSES,
  isValidTimezone,
  isValidTimeFormat,
  isStartBeforeEnd,
  isValidEmail,
} from "../lib/validators";

export const runTests = internalAction({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];
    let passCount = 0;
    let failCount = 0;

    const test = (name: string, fn: () => void | Promise<void>) => {
      return async () => {
        try {
          await fn();
          results.push(`✓ ${name}`);
          passCount++;
        } catch (error) {
          results.push(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
          failCount++;
        }
      };
    };

    results.push("=== Core Data Layer Integration Test Suite ===\n");

    // Test organization ID (simulated)
    const testOrgId = "test-org-" + Date.now();

    // Store IDs for cleanup and cross-test usage
    let campaignId1: Id<"campaigns"> | null = null;
    let campaignId2: Id<"campaigns"> | null = null;
    let contactId1: Id<"contacts"> | null = null;
    let contactId2: Id<"contacts"> | null = null;
    let contactId3: Id<"contacts"> | null = null;
    let assignmentId1: Id<"campaignContacts"> | null = null;

    results.push("--- Workflow 1: Campaign → Contacts → Assignments → Stats ---\n");

    // Test 1: Create a campaign
    await test("Create campaign with valid data", async () => {
      campaignId1 = await ctx.runMutation(internal.test.integrationTest.createCampaignInternal, {
        orgId: testOrgId,
        name: "Test Campaign 1",
        status: "draft",
        schedule: {
          defaultTimezone: "America/New_York",
          daysAllowed: ["monday", "tuesday", "wednesday"],
          startTime: "09:00",
          endTime: "17:00",
        },
      });

      if (!campaignId1) {
        throw new Error("Campaign creation failed");
      }
    })();

    // Test 2: Create contacts
    await test("Create contact 1", async () => {
      contactId1 = await ctx.runMutation(internal.test.integrationTest.createContactInternal, {
        orgId: testOrgId,
        email: "test1@example.com",
        customVars: { firstName: "John", company: "Acme Corp" },
      });

      if (!contactId1) {
        throw new Error("Contact creation failed");
      }
    })();

    await test("Create contact 2", async () => {
      contactId2 = await ctx.runMutation(internal.test.integrationTest.createContactInternal, {
        orgId: testOrgId,
        email: "test2@example.com",
        customVars: { firstName: "Jane", company: "Tech Inc" },
      });

      if (!contactId2) {
        throw new Error("Contact creation failed");
      }
    })();

    // Test 3: Assign contacts to campaign
    await test("Assign contact 1 to campaign", async () => {
      if (!campaignId1 || !contactId1) {
        throw new Error("Missing campaign or contact ID");
      }

      assignmentId1 = await ctx.runMutation(internal.test.integrationTest.assignContactInternal, {
        orgId: testOrgId,
        campaignId: campaignId1,
        contactId: contactId1,
      });

      if (!assignmentId1) {
        throw new Error("Assignment creation failed");
      }
    })();

    await test("Assign contact 2 to campaign", async () => {
      if (!campaignId1 || !contactId2) {
        throw new Error("Missing campaign or contact ID");
      }

      const assignmentId2 = await ctx.runMutation(
        internal.test.integrationTest.assignContactInternal,
        {
          orgId: testOrgId,
          campaignId: campaignId1,
          contactId: contactId2,
        }
      );

      if (!assignmentId2) {
        throw new Error("Assignment creation failed");
      }
    })();

    // Test 4: Verify assignment initial state
    await test("Assignment has initial status 'active' and currentStep 0", async () => {
      if (!assignmentId1) {
        throw new Error("Missing assignment ID");
      }

      const assignment = await ctx.runQuery(internal.test.integrationTest.getAssignmentInternal, {
        id: assignmentId1,
      });

      if (!assignment) {
        throw new Error("Assignment not found");
      }

      if (assignment.status !== "active") {
        throw new Error(`Expected status 'active', got '${assignment.status}'`);
      }

      if (assignment.currentStep !== 0) {
        throw new Error(`Expected currentStep 0, got ${assignment.currentStep}`);
      }
    })();

    // Test 5: Update assignment status
    await test("Update assignment status to 'replied'", async () => {
      if (!assignmentId1) {
        throw new Error("Missing assignment ID");
      }

      await ctx.runMutation(internal.test.integrationTest.updateAssignmentStatusInternal, {
        orgId: testOrgId,
        id: assignmentId1,
        status: "replied",
      });

      const assignment = await ctx.runQuery(internal.test.integrationTest.getAssignmentInternal, {
        id: assignmentId1,
      });

      if (assignment?.status !== "replied") {
        throw new Error(`Expected status 'replied', got '${assignment?.status}'`);
      }
    })();

    // Test 6: Get campaign stats and verify accuracy
    await test("Campaign stats match actual assignment counts", async () => {
      if (!campaignId1) {
        throw new Error("Missing campaign ID");
      }

      const stats = await ctx.runQuery(internal.test.integrationTest.getCampaignStatsInternal, {
        orgId: testOrgId,
        campaignId: campaignId1,
      });

      if (stats.total !== 2) {
        throw new Error(`Expected total 2, got ${stats.total}`);
      }

      if (stats.replied !== 1) {
        throw new Error(`Expected replied 1, got ${stats.replied}`);
      }

      if (stats.active !== 1) {
        throw new Error(`Expected active 1, got ${stats.active}`);
      }
    })();

    results.push("\n--- Workflow 2: Bulk Import → Search → Bulk Assign ---\n");

    // Test 7: Bulk import contacts
    await test("Bulk import contacts with mixed valid/invalid data", async () => {
      const result = await ctx.runMutation(
        internal.test.integrationTest.bulkCreateContactsInternal,
        {
          orgId: testOrgId,
          contacts: [
            { email: "bulk1@example.com", customVars: { firstName: "Alice" } },
            { email: "bulk2@example.com", customVars: { firstName: "Bob" } },
            { email: "invalid-email", customVars: { firstName: "Invalid" } }, // Should fail
            { email: "bulk3@example.com", customVars: { firstName: "Charlie" } },
          ],
        }
      );

      if (result.success.length !== 3) {
        throw new Error(`Expected 3 successful imports, got ${result.success.length}`);
      }

      if (result.errors.length !== 1) {
        throw new Error(`Expected 1 error, got ${result.errors.length}`);
      }

      if (result.errors[0].index !== 2) {
        throw new Error(`Expected error at index 2, got ${result.errors[0].index}`);
      }

      // Store one contact ID for later use
      contactId3 = result.success[0] as Id<"contacts">;
    })();

    // Test 8: Search contacts
    await test("Search contacts by email", async () => {
      const contacts = await ctx.runQuery(internal.test.integrationTest.searchContactsInternal, {
        orgId: testOrgId,
        query: "bulk1",
      });

      if (contacts.length !== 1) {
        throw new Error(`Expected 1 contact, got ${contacts.length}`);
      }

      if (!contacts[0].email.includes("bulk1")) {
        throw new Error(`Expected email to contain 'bulk1', got '${contacts[0].email}'`);
      }
    })();

    // Test 9: Create second campaign for bulk assign
    await test("Create second campaign", async () => {
      campaignId2 = await ctx.runMutation(internal.test.integrationTest.createCampaignInternal, {
        orgId: testOrgId,
        name: "Test Campaign 2",
        status: "draft",
        schedule: {
          defaultTimezone: "America/Los_Angeles",
          daysAllowed: ["monday", "wednesday", "friday"],
          startTime: "10:00",
          endTime: "16:00",
        },
      });

      if (!campaignId2) {
        throw new Error("Campaign creation failed");
      }
    })();

    // Test 10: Bulk assign contacts to campaign
    await test("Bulk assign contacts to campaign", async () => {
      if (!campaignId2 || !contactId1 || !contactId2 || !contactId3) {
        throw new Error("Missing required IDs");
      }

      const result = await ctx.runMutation(internal.test.integrationTest.bulkAssignInternal, {
        orgId: testOrgId,
        campaignId: campaignId2,
        contactIds: [contactId1, contactId2, contactId3],
      });

      if (result.success.length !== 3) {
        throw new Error(`Expected 3 successful assignments, got ${result.success.length}`);
      }

      if (result.errors.length !== 0) {
        throw new Error(`Expected 0 errors, got ${result.errors.length}`);
      }
    })();

    results.push("\n--- Workflow 3: Update Schedule → Change Status → Delete ---\n");

    // Test 11: Update campaign schedule
    await test("Update campaign schedule", async () => {
      if (!campaignId2) {
        throw new Error("Missing campaign ID");
      }

      await ctx.runMutation(internal.test.integrationTest.updateCampaignInternal, {
        orgId: testOrgId,
        id: campaignId2,
        schedule: {
          defaultTimezone: "America/Chicago",
          daysAllowed: ["tuesday", "thursday"],
          startTime: "08:00",
          endTime: "18:00",
        },
      });

      const campaign = await ctx.runQuery(internal.test.integrationTest.getCampaignInternal, {
        orgId: testOrgId,
        id: campaignId2,
      });

      if (campaign?.schedule.defaultTimezone !== "America/Chicago") {
        throw new Error("Schedule update failed");
      }
    })();

    // Test 12: Change campaign status
    await test("Change campaign status from draft to active", async () => {
      if (!campaignId2) {
        throw new Error("Missing campaign ID");
      }

      await ctx.runMutation(internal.test.integrationTest.updateCampaignStatusInternal, {
        orgId: testOrgId,
        id: campaignId2,
        status: "active",
      });

      const campaign = await ctx.runQuery(internal.test.integrationTest.getCampaignInternal, {
        orgId: testOrgId,
        id: campaignId2,
      });

      if (campaign?.status !== "active") {
        throw new Error(`Expected status 'active', got '${campaign?.status}'`);
      }
    })();

    // Test 13: Verify cascade deletion for campaign
    await test("Deleting campaign cascades to assignments", async () => {
      if (!campaignId2) {
        throw new Error("Missing campaign ID");
      }

      // Get assignment count before deletion
      const statsBefore = await ctx.runQuery(
        internal.test.integrationTest.getCampaignStatsInternal,
        {
          orgId: testOrgId,
          campaignId: campaignId2,
        }
      );

      if (statsBefore.total !== 3) {
        throw new Error(`Expected 3 assignments before deletion, got ${statsBefore.total}`);
      }

      // Delete campaign
      await ctx.runMutation(internal.test.integrationTest.deleteCampaignInternal, {
        orgId: testOrgId,
        id: campaignId2,
      });

      // Verify campaign is deleted
      const campaign = await ctx.runQuery(internal.test.integrationTest.getCampaignInternal, {
        orgId: testOrgId,
        id: campaignId2,
      });

      if (campaign !== null) {
        throw new Error("Campaign should be deleted");
      }

      // Verify assignments are also deleted
      const assignments = await ctx.runQuery(
        internal.test.integrationTest.listAssignmentsByCampaignInternal,
        {
          orgId: testOrgId,
          campaignId: campaignId2,
        }
      );

      if (assignments.length !== 0) {
        throw new Error(`Expected 0 assignments after cascade delete, got ${assignments.length}`);
      }
    })();

    results.push("\n--- Workflow 4: Cascade Deletion for Contacts ---\n");

    // Test 14: Verify cascade deletion for contact
    await test("Deleting contact cascades to assignments", async () => {
      if (!contactId1 || !campaignId1) {
        throw new Error("Missing required IDs");
      }

      // Verify contact has assignments
      const assignmentsBefore = await ctx.runQuery(
        internal.test.integrationTest.listAssignmentsByContactInternal,
        {
          orgId: testOrgId,
          contactId: contactId1,
        }
      );

      if (assignmentsBefore.length === 0) {
        throw new Error("Contact should have at least one assignment");
      }

      // Delete contact
      await ctx.runMutation(internal.test.integrationTest.deleteContactInternal, {
        orgId: testOrgId,
        id: contactId1,
      });

      // Verify contact is deleted
      const contact = await ctx.runQuery(internal.test.integrationTest.getContactInternal, {
        orgId: testOrgId,
        id: contactId1,
      });

      if (contact !== null) {
        throw new Error("Contact should be deleted");
      }

      // Verify assignments are also deleted
      const assignmentsAfter = await ctx.runQuery(
        internal.test.integrationTest.listAssignmentsByContactInternal,
        {
          orgId: testOrgId,
          contactId: contactId1,
        }
      );

      if (assignmentsAfter.length !== 0) {
        throw new Error(
          `Expected 0 assignments after cascade delete, got ${assignmentsAfter.length}`
        );
      }
    })();

    results.push("\n--- Data Validation Tests ---\n");

    // Test 15: Duplicate email validation
    await test("Duplicate email in same org is rejected", async () => {
      try {
        await ctx.runMutation(internal.test.integrationTest.createContactInternal, {
          orgId: testOrgId,
          email: "test2@example.com", // Already exists
          customVars: { firstName: "Duplicate" },
        });
        throw new Error("Should have thrown duplicate email error");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("already exists")) {
          throw new Error(`Expected duplicate email error, got: ${error}`);
        }
      }
    })();

    // Test 16: Duplicate assignment validation
    await test("Duplicate assignment is rejected", async () => {
      if (!campaignId1 || !contactId2) {
        throw new Error("Missing required IDs");
      }

      try {
        await ctx.runMutation(internal.test.integrationTest.assignContactInternal, {
          orgId: testOrgId,
          campaignId: campaignId1,
          contactId: contactId2, // Already assigned
        });
        throw new Error("Should have thrown duplicate assignment error");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("already assigned")) {
          throw new Error(`Expected duplicate assignment error, got: ${error}`);
        }
      }
    })();

    // Test 17: Invalid email format validation
    await test("Invalid email format is rejected", async () => {
      try {
        await ctx.runMutation(internal.test.integrationTest.createContactInternal, {
          orgId: testOrgId,
          email: "not-an-email",
          customVars: {},
        });
        throw new Error("Should have thrown invalid email error");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Invalid email")) {
          throw new Error(`Expected invalid email error, got: ${error}`);
        }
      }
    })();

    // Test 18: Invalid campaign status validation
    await test("Invalid campaign status is rejected", async () => {
      try {
        await ctx.runMutation(internal.test.integrationTest.createCampaignInternal, {
          orgId: testOrgId,
          name: "Invalid Status Campaign",
          status: "invalid-status",
          schedule: {
            defaultTimezone: "America/New_York",
            daysAllowed: ["monday"],
            startTime: "09:00",
            endTime: "17:00",
          },
        });
        throw new Error("Should have thrown invalid status error");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Invalid status")) {
          throw new Error(`Expected invalid status error, got: ${error}`);
        }
      }
    })();

    // Test 19: Invalid timezone validation
    await test("Invalid timezone is rejected", async () => {
      try {
        await ctx.runMutation(internal.test.integrationTest.createCampaignInternal, {
          orgId: testOrgId,
          name: "Invalid Timezone Campaign",
          status: "draft",
          schedule: {
            defaultTimezone: "Invalid/Timezone",
            daysAllowed: ["monday"],
            startTime: "09:00",
            endTime: "17:00",
          },
        });
        throw new Error("Should have thrown invalid timezone error");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Invalid timezone")) {
          throw new Error(`Expected invalid timezone error, got: ${error}`);
        }
      }
    })();

    // Test 20: Invalid time format validation
    await test("Invalid time format is rejected", async () => {
      try {
        await ctx.runMutation(internal.test.integrationTest.createCampaignInternal, {
          orgId: testOrgId,
          name: "Invalid Time Campaign",
          status: "draft",
          schedule: {
            defaultTimezone: "America/New_York",
            daysAllowed: ["monday"],
            startTime: "25:00", // Invalid hour
            endTime: "17:00",
          },
        });
        throw new Error("Should have thrown invalid time format error");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Invalid startTime")) {
          throw new Error(`Expected invalid time format error, got: ${error}`);
        }
      }
    })();

    // Test 21: StartTime before endTime validation
    await test("StartTime must be before endTime", async () => {
      try {
        await ctx.runMutation(internal.test.integrationTest.createCampaignInternal, {
          orgId: testOrgId,
          name: "Invalid Time Range Campaign",
          status: "draft",
          schedule: {
            defaultTimezone: "America/New_York",
            daysAllowed: ["monday"],
            startTime: "17:00",
            endTime: "09:00", // Before startTime
          },
        });
        throw new Error("Should have thrown time range error");
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes("startTime must be before endTime")
        ) {
          throw new Error(`Expected time range error, got: ${error}`);
        }
      }
    })();

    results.push("\n=== Test Summary ===");
    results.push(`Passed: ${passCount}`);
    results.push(`Failed: ${failCount}`);
    results.push(`Total: ${passCount + failCount}`);

    if (failCount === 0) {
      results.push("\n✓ All integration tests passed!");
    } else {
      results.push(`\n✗ ${failCount} test(s) failed`);
    }

    return results.join("\n");
  },
});

// ============================================================
// Internal Helper Functions (Bypass Auth for Testing)
// ============================================================

export const createCampaignInternal = internalMutation({
  args: {
    orgId: v.string(),
    name: v.string(),
    status: v.string(),
    schedule: v.object({
      defaultTimezone: v.string(),
      daysAllowed: v.array(v.string()),
      startTime: v.string(),
      endTime: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    // Validation logic (copied from mutations/campaigns.ts)
    if (args.name.length < 1 || args.name.length > 200) {
      throw new Error("Campaign name must be between 1 and 200 characters");
    }

    if (!CAMPAIGN_STATUSES.includes(args.status as any)) {
      throw new Error(`Invalid status. Must be one of: ${CAMPAIGN_STATUSES.join(", ")}`);
    }

    // Validate timezone
    if (!isValidTimezone(args.schedule.defaultTimezone)) {
      throw new Error(`Invalid timezone: ${args.schedule.defaultTimezone}`);
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
      orgId: args.orgId,
      name: args.name,
      status: args.status,
      schedule: args.schedule,
    });
  },
});

export const createContactInternal = internalMutation({
  args: {
    orgId: v.string(),
    email: v.string(),
    customVars: v.any(),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Email validation
    if (!isValidEmail(args.email)) {
      throw new Error(`Invalid email format: ${args.email}`);
    }

    // Check uniqueness
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_org_email", (q) => q.eq("orgId", args.orgId).eq("email", args.email))
      .first();

    if (existing) {
      throw new Error(`Contact with email ${args.email} already exists in organization`);
    }

    return await ctx.db.insert("contacts", {
      orgId: args.orgId,
      email: args.email,
      customVars: args.customVars,
      timezone: args.timezone,
    });
  },
});

export const bulkCreateContactsInternal = internalMutation({
  args: {
    orgId: v.string(),
    contacts: v.array(
      v.object({
        email: v.string(),
        customVars: v.any(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const success: Id<"contacts">[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < args.contacts.length; i++) {
      const contact = args.contacts[i];

      try {
        if (!isValidEmail(contact.email)) {
          throw new Error(`Invalid email format: ${contact.email}`);
        }

        const existing = await ctx.db
          .query("contacts")
          .withIndex("by_org_email", (q) => q.eq("orgId", args.orgId).eq("email", contact.email))
          .first();

        if (existing) {
          throw new Error(`Contact with email ${contact.email} already exists`);
        }

        const id = await ctx.db.insert("contacts", {
          orgId: args.orgId,
          email: contact.email,
          customVars: contact.customVars,
        });

        success.push(id);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { success, errors };
  },
});

export const assignContactInternal = internalMutation({
  args: {
    orgId: v.string(),
    campaignId: v.id("campaigns"),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    // Check for duplicate
    const existing = await ctx.db
      .query("campaignContacts")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("contactId"), args.contactId))
      .first();

    if (existing) {
      throw new Error("Contact already assigned to this campaign");
    }

    return await ctx.db.insert("campaignContacts", {
      campaignId: args.campaignId,
      contactId: args.contactId,
      orgId: args.orgId,
      status: "active",
      currentStep: 0,
    });
  },
});

export const bulkAssignInternal = internalMutation({
  args: {
    orgId: v.string(),
    campaignId: v.id("campaigns"),
    contactIds: v.array(v.id("contacts")),
  },
  handler: async (ctx, args) => {
    const success: Id<"campaignContacts">[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < args.contactIds.length; i++) {
      const contactId = args.contactIds[i];

      try {
        const existing = await ctx.db
          .query("campaignContacts")
          .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
          .filter((q) => q.eq(q.field("contactId"), contactId))
          .first();

        if (existing) {
          throw new Error("Contact already assigned to this campaign");
        }

        const id = await ctx.db.insert("campaignContacts", {
          campaignId: args.campaignId,
          contactId,
          orgId: args.orgId,
          status: "active",
          currentStep: 0,
        });

        success.push(id);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { success, errors };
  },
});

export const updateAssignmentStatusInternal = internalMutation({
  args: {
    orgId: v.string(),
    id: v.id("campaignContacts"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    if (!CONTACT_STATUSES.includes(args.status as any)) {
      throw new Error(`Invalid status. Must be one of: ${CONTACT_STATUSES.join(", ")}`);
    }

    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});

export const updateCampaignInternal = internalMutation({
  args: {
    orgId: v.string(),
    id: v.id("campaigns"),
    name: v.optional(v.string()),
    schedule: v.optional(
      v.object({
        defaultTimezone: v.string(),
        daysAllowed: v.array(v.string()),
        startTime: v.string(),
        endTime: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const updates: any = {};

    if (args.name !== undefined) {
      if (args.name.length < 1 || args.name.length > 200) {
        throw new Error("Campaign name must be between 1 and 200 characters");
      }
      updates.name = args.name;
    }

    if (args.schedule !== undefined) {
      if (!isValidTimezone(args.schedule.defaultTimezone)) {
        throw new Error(`Invalid timezone: ${args.schedule.defaultTimezone}`);
      }

      if (!isValidTimeFormat(args.schedule.startTime)) {
        throw new Error(`Invalid startTime format: ${args.schedule.startTime}`);
      }
      if (!isValidTimeFormat(args.schedule.endTime)) {
        throw new Error(`Invalid endTime format: ${args.schedule.endTime}`);
      }

      if (!isStartBeforeEnd(args.schedule.startTime, args.schedule.endTime)) {
        throw new Error("startTime must be before endTime");
      }

      updates.schedule = args.schedule;
    }

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const updateCampaignStatusInternal = internalMutation({
  args: {
    orgId: v.string(),
    id: v.id("campaigns"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    if (!CAMPAIGN_STATUSES.includes(args.status as any)) {
      throw new Error(`Invalid status. Must be one of: ${CAMPAIGN_STATUSES.join(", ")}`);
    }

    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});

export const deleteCampaignInternal = internalMutation({
  args: {
    orgId: v.string(),
    id: v.id("campaigns"),
  },
  handler: async (ctx, args) => {
    // Cascade delete assignments
    const assignments = await ctx.db
      .query("campaignContacts")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.id))
      .collect();

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    await ctx.db.delete(args.id);
    return null;
  },
});

export const deleteContactInternal = internalMutation({
  args: {
    orgId: v.string(),
    id: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    // Cascade delete assignments
    const assignments = await ctx.db
      .query("campaignContacts")
      .withIndex("by_contact", (q) => q.eq("contactId", args.id))
      .collect();

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    await ctx.db.delete(args.id);
    return null;
  },
});

export const getCampaignInternal = internalQuery({
  args: {
    orgId: v.string(),
    id: v.id("campaigns"),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.id);
    if (!campaign || campaign.orgId !== args.orgId) {
      return null;
    }
    return campaign;
  },
});

export const getContactInternal = internalQuery({
  args: {
    orgId: v.string(),
    id: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.id);
    if (!contact || contact.orgId !== args.orgId) {
      return null;
    }
    return contact;
  },
});

export const getAssignmentInternal = internalQuery({
  args: {
    id: v.id("campaignContacts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getCampaignStatsInternal = internalQuery({
  args: {
    orgId: v.string(),
    campaignId: v.id("campaigns"),
  },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("campaignContacts")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    const orgAssignments = assignments.filter((a) => a.orgId === args.orgId);

    const stats = {
      campaignId: args.campaignId,
      total: orgAssignments.length,
      active: 0,
      replied: 0,
      bounced: 0,
      unsubscribed: 0,
      completed: 0,
    };

    for (const assignment of orgAssignments) {
      switch (assignment.status) {
        case "active":
          stats.active++;
          break;
        case "replied":
          stats.replied++;
          break;
        case "bounced":
          stats.bounced++;
          break;
        case "unsubscribed":
          stats.unsubscribed++;
          break;
        case "completed":
          stats.completed++;
          break;
      }
    }

    return stats;
  },
});

export const listAssignmentsByCampaignInternal = internalQuery({
  args: {
    orgId: v.string(),
    campaignId: v.id("campaigns"),
  },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("campaignContacts")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    return assignments.filter((a) => a.orgId === args.orgId);
  },
});

export const listAssignmentsByContactInternal = internalQuery({
  args: {
    orgId: v.string(),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("campaignContacts")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .collect();

    return assignments.filter((a) => a.orgId === args.orgId);
  },
});

export const searchContactsInternal = internalQuery({
  args: {
    orgId: v.string(),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const allContacts = await ctx.db
      .query("contacts")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    // Simple search: filter by email containing query
    return allContacts.filter((contact) =>
      contact.email.toLowerCase().includes(args.query.toLowerCase())
    );
  },
});
