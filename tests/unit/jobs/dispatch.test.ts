import { describe, expect, test } from "vitest";

import { dispatchDueSends, type DispatchDeps } from "../../../src/server/jobs/dispatch";
import { FakeJobQueue } from "../../fakes/fake-queue";

function makeDeps(overrides: Partial<DispatchDeps> = {}): DispatchDeps {
  const due = [
    {
      assignmentId: "assignment_1",
      campaignId: "campaign_1",
      contactId: "contact_1",
      orgId: "org_1",
      currentStep: 0,
      status: "active",
      contactEmail: "ada@example.com",
      contactTimezone: "America/New_York",
      contactBounceStatus: undefined,
      campaignStatus: "active",
      campaignSchedule: {
        timezone: "America/New_York",
        startTime: "09:00",
        endTime: "17:00",
        daysOfWeek: ["monday"],
      },
      campaignSteps: [{ subject: "Hi", body: "Hello" }],
    },
  ];
  const queue = new FakeJobQueue();
  return {
    queue,
    now: () => Date.parse("2026-07-06T14:00:00.000Z"),
    random: () => 0,
    repos: {
      assignments: {
        listDueForDispatch: async () => due,
        markEnqueued: async () => {},
        deferUntil: async () => {},
      },
      campaignMailboxes: {
        listDispatchMailboxes: async () => [
          {
            mailboxId: "mailbox_2",
            emailsSentToday: 3,
            dailySendLimit: 25,
            lastUsedAt: 200,
          },
          {
            mailboxId: "mailbox_1",
            emailsSentToday: 1,
            dailySendLimit: 25,
            lastUsedAt: 500,
          },
        ],
        updateLastUsed: async () => {},
        reserveCapacity: async () => true,
        releaseCapacity: async () => {},
      },
      blocklist: {
        isBlocked: async () => false,
      },
    },
    ...overrides,
  };
}

describe("dispatchDueSends", () => {
  test("enqueues due assignment with assignment-step idempotency key", async () => {
    const deps = makeDeps();

    await expect(dispatchDueSends(deps)).resolves.toMatchObject({ enqueued: 1, limit: 100 });

    expect((deps.queue as FakeJobQueue).jobs[0]).toMatchObject({
      name: "campaign.send",
      payload: {
        assignmentId: "assignment_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        mailboxId: "mailbox_1",
        orgId: "org_1",
        stepNumber: 0,
      },
      options: {
        idempotencyKey: "assignment_1:0",
      },
    });
  });

  test("defers work outside send window", async () => {
    let deferredAt = 0;
    const deps = makeDeps({
      now: () => Date.parse("2026-07-06T22:00:00.000Z"),
    });
    deps.repos.assignments.deferUntil = async (_id, _orgId, at) => {
      deferredAt = at;
    };

    await expect(dispatchDueSends(deps)).resolves.toMatchObject({ enqueued: 0, deferred: 1 });
    expect((deps.queue as FakeJobQueue).jobs).toHaveLength(0);
    expect(deferredAt).toBeGreaterThan(Date.parse("2026-07-06T22:00:00.000Z"));
  });

  test("skips blocked contacts", async () => {
    const deps = makeDeps();
    deps.repos.blocklist.isBlocked = async () => true;

    await expect(dispatchDueSends(deps)).resolves.toMatchObject({ enqueued: 0, skipped: 1 });
  });

  test("skips invalid verified contacts", async () => {
    const deps = makeDeps();
    const due = await deps.repos.assignments.listDueForDispatch({ now: 0, limit: 1 });
    deps.repos.assignments.listDueForDispatch = async () =>
      due.map((item) => ({ ...item, contactVerificationStatus: "invalid" }));

    await expect(dispatchDueSends(deps)).resolves.toMatchObject({ enqueued: 0, skipped: 1 });
  });

  test("reports missing capacity when linked mailboxes are capped", async () => {
    const deps = makeDeps();
    deps.repos.campaignMailboxes.listDispatchMailboxes = async () => [
      { mailboxId: "mailbox_1", emailsSentToday: 25, dailySendLimit: 25 },
    ];

    await expect(dispatchDueSends(deps)).resolves.toMatchObject({
      enqueued: 0,
      missingCapacity: 1,
    });
  });

  test("skips mailboxes with future provider limit reset", async () => {
    const deps = makeDeps();
    deps.repos.campaignMailboxes.listDispatchMailboxes = async () => [
      {
        mailboxId: "mailbox_1",
        emailsSentToday: 0,
        dailySendLimit: 25,
        providerLimitResetAt: Date.parse("2026-07-06T15:00:00.000Z"),
      },
    ];

    await expect(dispatchDueSends(deps)).resolves.toMatchObject({
      enqueued: 0,
      missingCapacity: 1,
    });
  });

  test("uses ramp capacity when ramp is enabled", async () => {
    const deps = makeDeps();
    deps.repos.campaignMailboxes.listDispatchMailboxes = async () => [
      {
        mailboxId: "mailbox_1",
        emailsSentToday: 5,
        dailySendLimit: 25,
        providerSafeLimit: 100,
        rampEnabled: true,
        rampCurrentLimit: 5,
      },
    ];

    await expect(dispatchDueSends(deps)).resolves.toMatchObject({
      enqueued: 0,
      missingCapacity: 1,
    });
  });

  test("rotates by utilization instead of raw send count", async () => {
    const deps = makeDeps();
    deps.repos.campaignMailboxes.listDispatchMailboxes = async () => [
      {
        mailboxId: "mailbox_1",
        emailsSentToday: 10,
        dailySendLimit: 20,
        providerSafeLimit: 100,
      },
      {
        mailboxId: "mailbox_2",
        emailsSentToday: 20,
        dailySendLimit: 100,
        providerSafeLimit: 100,
      },
    ];

    await dispatchDueSends(deps);

    expect((deps.queue as FakeJobQueue).jobs[0]).toMatchObject({
      payload: { mailboxId: "mailbox_2" },
    });
  });

  test("respects batch limit", async () => {
    const deps = makeDeps();

    await dispatchDueSends({ ...deps, limit: 1 });

    expect((deps.queue as FakeJobQueue).jobs).toHaveLength(1);
  });

  test("defers due work when organization backpressure is active", async () => {
    let deferredAt = 0;
    const deps = makeDeps({
      limits: {
        check: async () => {
          throw new Error("machine guard should not be used");
        },
        checkPublic: async () => {
          throw new Error("public guard should not be used");
        },
        checkSubject: async () => ({
          allowed: false,
          policyId: "org.burst",
          limit: 100,
          remaining: 0,
          retryAfterMs: 30_000,
          resetAt: Date.parse("2026-07-06T14:00:30.000Z"),
        }),
      },
    });
    deps.repos.assignments.deferUntil = async (_id, _orgId, at) => {
      deferredAt = at;
    };

    await expect(dispatchDueSends(deps)).resolves.toMatchObject({ enqueued: 0, deferred: 1 });
    expect((deps.queue as FakeJobQueue).jobs).toHaveLength(0);
    expect(deferredAt).toBe(Date.parse("2026-07-06T14:00:30.000Z"));
  });
});
