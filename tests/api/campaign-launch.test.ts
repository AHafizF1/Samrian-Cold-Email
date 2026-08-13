import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { PATCH } from "../../src/app/api/campaigns/[id]/route";
import { POST as launch } from "../../src/app/api/campaigns/[id]/launch/route";

vi.mock("../../src/server/api/session-route", () => ({
  createSessionRoute:
    (_operation: unknown, handler: (context: unknown, ...args: unknown[]) => Promise<unknown>) =>
    (...args: unknown[]) =>
      handler({ orgId: "org_1", userId: "user_1", role: "owner", db: {} }, ...args),
}));

vi.mock("../../src/server/auth", () => ({
  requireOrgAccess: vi.fn(async () => ({ orgId: "org_1", userId: "user_1", role: "owner" })),
}));

vi.mock("../../src/server/db/db", () => ({
  getDb: vi.fn(() => ({
    transaction: vi.fn((fn) => fn({})),
  })),
}));

vi.mock("../../src/server/modules/campaigns", () => ({
  CampaignLaunchError: class CampaignLaunchError extends Error {},
  createCampaignLaunchDeps: vi.fn(() => ({})),
  launchCampaign: vi.fn(async () => ({
    status: "launched",
    campaignId: "campaign_1",
    assignmentCount: 2,
    createdAssignments: 2,
    existingAssignments: 0,
    linkedMailboxCount: 1,
    skippedContacts: { blocked: 0, bounced: 0, missing: 0 },
    warnings: [],
  })),
}));

describe("campaign launch api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("does not allow PATCH status active to bypass launch validation", async () => {
    const response = await PATCH(jsonRequest({ status: "active" }), {
      params: Promise.resolve({ id: "campaign_1" }),
    });

    await expect(response.json()).resolves.toMatchObject({
      error: "Use the launch endpoint to activate campaigns",
    });
    expect(response.status).toBe(400);
  });

  test("launch endpoint returns structured launch result", async () => {
    const response = await launch(jsonRequest({ mailboxIds: ["mailbox_1"] }), {
      params: Promise.resolve({ id: "campaign_1" }),
    });

    await expect(response.json()).resolves.toMatchObject({
      status: "launched",
      assignmentCount: 2,
      linkedMailboxCount: 1,
    });
    expect(response.status).toBe(200);
  });
});

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/campaigns/campaign_1", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
