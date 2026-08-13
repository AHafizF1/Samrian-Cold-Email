import { describe, expect, test } from "vitest";

import { evaluateCampaignHealth } from "../../../src/server/modules/health";
import { FakeNotificationRepo } from "../../fakes/fake-repos";

describe("campaign health module", () => {
  test("pauses campaign once when bounce threshold is exceeded", async () => {
    const notifications = new FakeNotificationRepo();
    const updated: string[] = [];

    await expect(
      evaluateCampaignHealth(
        {
          campaignId: "campaign_1",
          orgId: "org_1",
          campaignName: "Launch",
          stats: { total: 100, bounced: 8, unsubscribed: 1 },
          thresholds: { bouncePauseRate: 0.05, unsubscribePauseRate: 0.1, minSample: 20 },
        },
        {
          campaigns: {
            updateStatus: async (_id, _orgId, status) => {
              updated.push(status);
            },
          },
          notifications,
        }
      )
    ).resolves.toEqual({ paused: true, reason: "bounce-rate" });

    expect(updated).toEqual(["paused"]);
    expect(notifications.data).toMatchObject([{ type: "campaign_paused" }]);
  });

  test("does not pause below minimum sample", async () => {
    const notifications = new FakeNotificationRepo();
    const updated: string[] = [];

    await expect(
      evaluateCampaignHealth(
        {
          campaignId: "campaign_1",
          orgId: "org_1",
          stats: { total: 5, bounced: 5, unsubscribed: 5 },
          thresholds: { bouncePauseRate: 0.05, unsubscribePauseRate: 0.05, minSample: 20 },
        },
        {
          campaigns: {
            updateStatus: async (_id, _orgId, status) => {
              updated.push(status);
            },
          },
          notifications,
        }
      )
    ).resolves.toEqual({ paused: false });

    expect(updated).toEqual([]);
    expect(notifications.data).toEqual([]);
  });
});
