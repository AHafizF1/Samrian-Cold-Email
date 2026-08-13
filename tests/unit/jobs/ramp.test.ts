import { describe, expect, test } from "vitest";

import { evaluateMailboxRamps } from "../../../src/server/jobs/ramp";

describe("evaluateMailboxRamps", () => {
  test("evaluates bounded due mailboxes and isolates failures", async () => {
    const updates: string[] = [];
    const result = await evaluateMailboxRamps({
      now: () => Date.parse("2026-07-25T12:00:00.000Z"),
      limit: 2,
      listDue: async () => [
        {
          id: "mailbox_1",
          orgId: "org_1",
          email: "one@example.com",
          status: "active",
          rampEnabled: true,
          rampStatus: "ramping",
          rampCurrentLimit: 10,
          rampTargetLimit: 30,
          rampIncrement: 5,
          rampStartedAt: Date.parse("2026-07-15T12:00:00.000Z"),
        },
        {
          id: "mailbox_2",
          orgId: "org_2",
          email: "two@example.com",
          status: "active",
          rampEnabled: true,
          rampStatus: "ramping",
          rampCurrentLimit: 10,
          rampTargetLimit: 30,
          rampIncrement: 5,
        },
        {
          id: "mailbox_3",
          orgId: "org_3",
          email: "three@example.com",
        },
      ],
      transaction: async (_orgId, operation) =>
        operation({
          getEvidence: async (mailboxId) => {
            if (mailboxId === "mailbox_2") throw new Error("evidence unavailable");
            return {
              sent: 20,
              failed: 0,
              hardBounces: 0,
              softBounces: 0,
              unsubscribes: 0,
            };
          },
          update: async (mailboxId, _orgId, decision) => {
            updates.push(`${mailboxId}:${decision.status}:${decision.currentLimit}`);
            return true;
          },
        }),
    });

    expect(result).toMatchObject({ advanced: 1, failed: 1, limit: 2 });
    expect(updates).toEqual(["mailbox_1:ramping:15"]);
  });

  test("reports held mailbox without treating it as failure", async () => {
    const result = await evaluateMailboxRamps({
      now: () => Date.parse("2026-07-25T12:00:00.000Z"),
      listDue: async () => [
        {
          id: "mailbox_1",
          orgId: "org_1",
          email: "one@example.com",
          status: "active",
          rampEnabled: true,
          rampStatus: "ramping",
          rampCurrentLimit: 10,
          rampTargetLimit: 30,
          rampIncrement: 5,
        },
      ],
      transaction: async (_orgId, operation) =>
        operation({
          getEvidence: async () => ({
            sent: 2,
            failed: 0,
            hardBounces: 0,
            softBounces: 0,
            unsubscribes: 0,
          }),
          update: async () => true,
        }),
    });

    expect(result).toMatchObject({ held: 1, failed: 0 });
  });

  test("notifies once when a mailbox enters a meaningful state", async () => {
    const notifications: string[] = [];
    const mailbox = {
      id: "mailbox_1",
      orgId: "org_1",
      email: "one@example.com",
      status: "active" as const,
      rampEnabled: true,
      rampStatus: "ramping",
      rampCurrentLimit: 15,
      rampTargetLimit: 30,
      rampIncrement: 5,
    };

    await evaluateMailboxRamps({
      now: () => Date.parse("2026-07-25T12:00:00.000Z"),
      listDue: async () => [mailbox],
      transaction: async (_orgId, operation) =>
        operation({
          getEvidence: async () => ({
            sent: 20,
            failed: 0,
            hardBounces: 1,
            softBounces: 0,
            unsubscribes: 0,
          }),
          update: async () => true,
          notifications: {
            create: async (input) => {
              notifications.push(input.type);
              return {
                id: "notification_1",
                orgId: input.orgId,
                type: input.type,
                title: input.title,
                createdAt: Date.now(),
              };
            },
            getById: async () => null,
            listLatest: async () => [],
            countUnread: async () => 0,
            markRead: async () => {},
            markAllRead: async () => 0,
          },
        }),
    });

    expect(notifications).toEqual(["mailbox_ramp"]);
  });

  test("ignores a concurrent duplicate evaluation", async () => {
    const notifications: string[] = [];
    const result = await evaluateMailboxRamps({
      now: () => Date.parse("2026-07-25T12:00:00.000Z"),
      listDue: async () => [
        {
          id: "mailbox_1",
          orgId: "org_1",
          email: "one@example.com",
          status: "active",
          rampEnabled: true,
          rampStatus: "ramping",
          rampCurrentLimit: 10,
          rampTargetLimit: 30,
          rampIncrement: 5,
          rampStartedAt: Date.parse("2026-07-15T12:00:00.000Z"),
        },
      ],
      transaction: async (_orgId, operation) =>
        operation({
          getEvidence: async () => ({
            sent: 20,
            failed: 0,
            hardBounces: 0,
            softBounces: 0,
            unsubscribes: 0,
          }),
          update: async () => false,
          audit: async () => {
            notifications.push("audit");
          },
        }),
    });

    expect(result).toMatchObject({ advanced: 0, unchanged: 1 });
    expect(notifications).toEqual([]);
  });
});
