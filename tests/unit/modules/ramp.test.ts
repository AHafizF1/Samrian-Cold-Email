import { describe, expect, test } from "vitest";

import { evaluateRamp, getMailboxCapacity, type RampInput } from "../../../src/server/modules/ramp";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-07-25T12:00:00.000Z");

function input(overrides: Partial<RampInput> = {}): RampInput {
  return {
    enabled: true,
    status: "ramping",
    mailboxStatus: "active",
    startedAt: now - 8 * DAY,
    currentLimit: 10,
    targetLimit: 30,
    increment: 5,
    nextCheckAt: now,
    sent: 20,
    failed: 0,
    hardBounces: 0,
    softBounces: 0,
    unsubscribes: 0,
    providerLimitResetAt: undefined,
    archived: false,
    domainStatus: "pass",
    now,
    ...overrides,
  };
}

describe("mailbox ramp", () => {
  test("uses minimum provider, user, and ramp limit with reply reserve", () => {
    expect(
      getMailboxCapacity({
        providerLimit: 100,
        userLimit: 50,
        rampEnabled: true,
        rampLimit: 20,
        sentToday: 7,
        reserved: 3,
        replyReserve: 2,
      })
    ).toEqual({
      effectiveLimit: 20,
      campaignLimit: 18,
      used: 10,
      available: 8,
      utilization: 0.5,
    });
  });

  test("calendar eligibility alone does not advance without evidence", () => {
    expect(evaluateRamp(input({ sent: 4 }))).toMatchObject({
      status: "held",
      currentLimit: 10,
      reason: "insufficient-sample",
    });
  });

  test("healthy evidence cannot skip its calendar stage", () => {
    expect(
      evaluateRamp(
        input({
          startedAt: now - DAY,
          currentLimit: 5,
          sent: 20,
        })
      )
    ).toMatchObject({
      status: "held",
      currentLimit: 5,
      reason: "age-stage",
    });
  });

  test("healthy evidence advances one increment without exceeding target", () => {
    expect(evaluateRamp(input())).toMatchObject({
      status: "ramping",
      currentLimit: 15,
      reason: "healthy",
    });
  });

  test("soft bounce or failure pressure reduces capacity", () => {
    expect(evaluateRamp(input({ failed: 4, softBounces: 2 }))).toMatchObject({
      status: "reduced",
      currentLimit: 5,
      reason: "delivery-pressure",
    });
  });

  test("hard bounce threshold pauses ramp", () => {
    expect(evaluateRamp(input({ sent: 20, hardBounces: 2 }))).toMatchObject({
      status: "paused",
      currentLimit: 5,
      reason: "hard-bounce-rate",
    });
  });

  test("provider throttle holds until reset", () => {
    expect(evaluateRamp(input({ providerLimitResetAt: now + DAY }))).toMatchObject({
      status: "held",
      currentLimit: 10,
      holdUntil: now + DAY,
      reason: "provider-throttle",
    });
  });

  test("disconnected or archived mailbox pauses", () => {
    expect(evaluateRamp(input({ mailboxStatus: "disconnected" }))).toMatchObject({
      status: "paused",
      reason: "mailbox-unavailable",
    });
    expect(evaluateRamp(input({ archived: true }))).toMatchObject({
      status: "paused",
      reason: "mailbox-unavailable",
    });
  });

  test("recovery cannot jump directly to target", () => {
    expect(evaluateRamp(input({ status: "paused", currentLimit: 5 }))).toMatchObject({
      status: "recovering",
      currentLimit: 5,
      reason: "recovering",
    });
  });

  test("open metrics are not part of ramp input", () => {
    expect("opens" in input()).toBe(false);
  });
});
