import { describe, expect, test } from "vitest";

import { buildStatsSummary } from "../../../src/server/modules/stats";

describe("stats module", () => {
  test("labels opens unavailable when tracking is disabled", () => {
    expect(
      buildStatsSummary({
        sent: 10,
        failed: 0,
        replies: 2,
        unsubscribes: 1,
        hardBounces: 1,
        softBounces: 0,
        totalClicks: 3,
        uniqueClicks: 2,
        totalOpens: 9,
        uniqueOpens: 8,
        openTrackingEnabled: false,
      })
    ).toMatchObject({
      estimatedOpenRate: null,
      replyRate: 20,
      bounceRate: 10,
      unsubscribeRate: 10,
      clickRate: 20,
    });
  });

  test("returns estimated open rate only when enabled", () => {
    expect(
      buildStatsSummary({
        sent: 10,
        failed: 0,
        replies: 0,
        unsubscribes: 0,
        hardBounces: 0,
        softBounces: 0,
        totalClicks: 0,
        uniqueClicks: 0,
        totalOpens: 9,
        uniqueOpens: 4,
        openTrackingEnabled: true,
      }).estimatedOpenRate
    ).toBe(40);
  });
});
