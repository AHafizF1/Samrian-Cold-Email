import { describe, expect, test } from "vitest";

import { classifyBounce, processBounce } from "../../../src/server/jobs/bounce";
import { FakeRepos } from "../../fakes/fake-repos";

describe("bounce jobs", () => {
  test("classifies explicit and DSN bounce types", () => {
    expect(classifyBounce({ bounceType: "soft" })).toBe("soft");
    expect(classifyBounce({ dsnCode: "5.1.1" })).toBe("hard");
    expect(classifyBounce({ dsnCode: "4.2.2" })).toBe("soft");
    expect(classifyBounce({ rawBody: "mailbox not found" })).toBe("hard");
  });

  test("hard bounce updates contact, assignment, blocklist, and pauses campaign over threshold", async () => {
    const repos = new FakeRepos({
      campaigns: [{ id: "campaign_1", orgId: "org_1", name: "Launch", steps: [] }],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "bad@example.com", customVars: {} }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
      campaignStats: [{ campaignId: "campaign_1", total: 10, bounced: 1 }],
    });

    await expect(
      processBounce(
        {
          messageId: "message_1",
          orgId: "org_1",
          campaignId: "campaign_1",
          contactId: "contact_1",
          dsnCode: "5.1.1",
        },
        { repos, bounceRateThreshold: 0.05 }
      )
    ).resolves.toEqual({
      status: "processed",
      messageId: "message_1",
      email: "bad@example.com",
      bounceType: "hard",
      campaignPaused: true,
    });

    expect(repos.contacts.data[0].bounceStatus).toBe("hard");
    expect(repos.assignments.data[0].status).toBe("bounced");
    expect(repos.blocklist.data).toMatchObject([
      { email: "bad@example.com", reason: "bounced_hard" },
    ]);
    expect(repos.campaigns.data[0].status).toBe("paused");
  });
});
