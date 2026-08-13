import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { createDb } from "../../src/server/db/db";
import { mailboxes, sendReservations } from "../../src/server/db/schema";
import { PostgresCampaignMailboxRepo, PostgresMailboxRepo } from "../../src/server/repos";

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("PostgresMailboxRepo ramp", () => {
  const db = url ? createDb({ driver: "postgres-js", url }).client : undefined;
  const repo = db ? new PostgresMailboxRepo(db) : undefined;
  const capacity = db ? new PostgresCampaignMailboxRepo(db) : undefined;

  beforeEach(async () => {
    await db!.delete(sendReservations).where(eq(sendReservations.orgId, "org_ramp"));
    await db!.delete(mailboxes).where(eq(mailboxes.orgId, "org_ramp"));
  });

  test("persists ramp config and due evaluation state", async () => {
    const mailbox = await repo!.create({
      orgId: "org_ramp",
      name: "Ramp sender",
      provider: "smtp",
      userEmail: "ramp@example.com",
      dailySendLimit: 30,
    });

    await repo!.configureRamp(mailbox.id, "org_ramp", {
      action: "enable",
      targetLimit: 30,
      now: Date.parse("2026-07-25T00:00:00.000Z"),
    });

    await expect(repo!.getById(mailbox.id, "org_ramp")).resolves.toMatchObject({
      rampEnabled: true,
      rampStatus: "pending",
      rampCurrentLimit: 5,
      rampTargetLimit: 30,
    });
    await expect(
      repo!.listRampDue(Date.parse("2026-07-25T00:00:00.000Z"), 10)
    ).resolves.toHaveLength(1);

    const current = await repo!.getById(mailbox.id, "org_ramp");
    const decision = {
      status: "ramping" as const,
      currentLimit: 10,
      reason: "healthy" as const,
      nextCheckAt: Date.parse("2026-07-26T00:00:00.000Z"),
    };
    await expect(
      repo!.updateRamp(mailbox.id, "org_ramp", decision, Date.parse("2026-07-24T00:00:00.000Z"))
    ).resolves.toBe(false);
    await expect(
      repo!.updateRamp(mailbox.id, "org_ramp", decision, current!.rampNextCheckAt)
    ).resolves.toBe(true);
  });

  test("reserves one assignment step idempotently and releases it once", async () => {
    const mailbox = await repo!.create({
      orgId: "org_ramp",
      name: "Capacity sender",
      provider: "smtp",
      userEmail: "capacity@example.com",
      dailySendLimit: 30,
    });
    const input = {
      mailboxId: mailbox.id,
      assignmentId: "assignment_1",
      stepNumber: 0,
      orgId: "org_ramp",
      limit: 10,
      now: Date.parse("2026-07-25T00:00:00.000Z"),
    };

    await expect(capacity!.reserveCapacity(input)).resolves.toBe(true);
    await expect(capacity!.reserveCapacity(input)).resolves.toBe(true);
    await expect(
      db!.select().from(sendReservations).where(eq(sendReservations.orgId, "org_ramp"))
    ).resolves.toHaveLength(1);
    await expect(repo!.getById(mailbox.id, "org_ramp")).resolves.toMatchObject({
      reservedSends: 1,
    });

    await capacity!.releaseCapacity(input);
    await capacity!.releaseCapacity(input);
    await expect(repo!.getById(mailbox.id, "org_ramp")).resolves.toMatchObject({
      reservedSends: 0,
    });
  });
});
