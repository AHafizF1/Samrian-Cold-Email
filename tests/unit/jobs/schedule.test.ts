import { describe, expect, test } from "vitest";

import {
  getJitterMs,
  getStepDelayMs,
  isInSendWindow,
  nextWindowStart,
} from "../../../src/server/jobs/schedule";

const schedule = {
  timezone: "America/New_York",
  startTime: "09:00",
  endTime: "17:00",
  daysOfWeek: ["monday", "tuesday", "wednesday", "thursday", "friday"],
};

describe("send schedule", () => {
  test("detects inside and outside send window", () => {
    expect(
      isInSendWindow({
        schedule,
        now: Date.parse("2026-07-06T14:00:00.000Z"),
      })
    ).toBe(true);

    expect(
      isInSendWindow({
        schedule,
        now: Date.parse("2026-07-06T22:00:00.000Z"),
      })
    ).toBe(false);
  });

  test("enforces allowed send days", () => {
    expect(
      isInSendWindow({
        schedule,
        now: Date.parse("2026-07-04T14:00:00.000Z"),
      })
    ).toBe(false);
  });

  test("contact timezone overrides campaign timezone", () => {
    expect(
      isInSendWindow({
        schedule,
        contactTimezone: "America/Los_Angeles",
        now: Date.parse("2026-07-06T14:00:00.000Z"),
      })
    ).toBe(false);
  });

  test("finds next window start across day boundary", () => {
    expect(
      nextWindowStart({
        schedule,
        now: Date.parse("2026-07-03T22:00:00.000Z"),
      })
    ).toBe(Date.parse("2026-07-06T13:00:00.000Z"));
  });

  test("uses first step immediate and follow-up default delay", () => {
    expect(getStepDelayMs([{ subject: "A" }], 0)).toBe(0);
    expect(getStepDelayMs([{ subject: "A" }, { subject: "B" }], 1)).toBe(3 * 24 * 60 * 60 * 1000);
  });

  test("explicit step delay overrides default", () => {
    expect(
      getStepDelayMs([{ subject: "A" }, { subject: "B", delayDays: 1, delayHours: 6 }], 1)
    ).toBe(30 * 60 * 60 * 1000);
  });

  test("jitter uses injected random within bounds", () => {
    expect(getJitterMs({ minMs: 1000, maxMs: 5000, random: () => 0.5 })).toBe(3000);
  });
});
