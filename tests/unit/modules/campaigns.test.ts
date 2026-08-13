import { describe, expect, test, vi } from "vitest";

import {
  launchCampaign,
  saveCampaignDraft,
  validateCampaignLaunch,
} from "../../../src/server/modules/campaigns";
import type { ContactRecord } from "../../../src/server/ports";

describe("campaign launch module", () => {
  test("saves campaign draft and mailbox links through one module", async () => {
    const campaigns = { getLaunch: vi.fn(), saveDraft: vi.fn().mockResolvedValue("campaign_1") };
    const campaignMailboxes = { replaceForCampaign: vi.fn() };

    await expect(
      saveCampaignDraft(
        {
          orgId: "org_1",
          name: "Outbound",
          schedule: {},
          steps: [{}],
          mailboxIds: ["mailbox_1"],
        },
        { campaigns, campaignMailboxes }
      )
    ).resolves.toBe("campaign_1");
    expect(campaignMailboxes.replaceForCampaign).toHaveBeenCalledWith({
      campaignId: "campaign_1",
      orgId: "org_1",
      mailboxIds: ["mailbox_1"],
    });
  });

  test("rejects updates to non-draft campaigns before write", async () => {
    const campaigns = {
      getLaunch: vi.fn().mockResolvedValue({ status: "active" }),
      saveDraft: vi.fn(),
    };

    await expect(
      saveCampaignDraft(
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Outbound",
          schedule: {},
          steps: [{}],
        },
        { campaigns, campaignMailboxes: { replaceForCampaign: vi.fn() } }
      )
    ).rejects.toMatchObject({ code: "conflict" });
    expect(campaigns.saveDraft).not.toHaveBeenCalled();
  });

  test("validates launch readiness without writing campaign state", async () => {
    const deps = createDeps();

    await expect(
      validateCampaignLaunch(
        { campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] },
        deps
      )
    ).resolves.toMatchObject({ ready: true, eligibleContacts: 2, linkedMailboxes: 1 });
    expect(deps.campaigns.status).toBe("draft");
  });

  test("launches a draft campaign by validating mailboxes and materializing assignments", async () => {
    const deps = createDeps();

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).resolves.toMatchObject({
      status: "launched",
      campaignId: "campaign_1",
      assignmentCount: 2,
      createdAssignments: 2,
      existingAssignments: 0,
      linkedMailboxCount: 1,
      skippedContacts: { blocked: 0, bounced: 0, missing: 0 },
    });
    expect(deps.campaigns.status).toBe("active");
  });

  test("rejects launch with no active mailbox", async () => {
    const deps = createDeps({ mailboxes: [] });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: [] }, deps)
    ).rejects.toMatchObject({
      issues: ["Select at least one active mailbox"],
    });
  });

  test("rejects wrong-org campaign as not found", async () => {
    const deps = createDeps({ missingCampaign: true });

    await expect(
      launchCampaign(
        { campaignId: "campaign_1", orgId: "org_other", mailboxIds: ["mailbox_1"] },
        deps
      )
    ).rejects.toMatchObject({
      issues: ["Campaign not found"],
    });
  });

  test("rejects launch without name, email step, or usable schedule", async () => {
    const deps = createDeps({ name: "", steps: [], schedule: { daysAllowed: [] } });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).rejects.toMatchObject({
      issues: [
        "Campaign name is required",
        "Add at least one email step",
        "Campaign schedule must include send days and a valid time window",
      ],
    });
  });

  test("skips blocked and hard-bounced contacts, then fails when no eligible contacts remain", async () => {
    const deps = createDeps({
      contacts: [
        { id: "contact_1", orgId: "org_1", email: "blocked@example.com", customVars: {} },
        {
          id: "contact_2",
          orgId: "org_1",
          email: "bounced@example.com",
          customVars: {},
          bounceStatus: "hard",
        },
      ],
      blocked: new Set(["blocked@example.com"]),
    });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).rejects.toMatchObject({
      issues: ["Campaign has no eligible contacts"],
      skippedContacts: { blocked: 1, bounced: 1, missing: 0 },
    });
  });

  test("returns already-active without duplicating assignments", async () => {
    const deps = createDeps({ status: "active", existingAssignments: 2 });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).resolves.toMatchObject({
      status: "already-active",
      createdAssignments: 0,
      existingAssignments: 2,
    });
  });

  test("launches a dynamic group by resolving matching contacts", async () => {
    const deps = createDeps({
      targetContactIds: null,
      targetGroupId: "group_1",
      dynamicGroup: true,
    });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).resolves.toMatchObject({
      status: "launched",
      assignmentCount: 2,
    });
  });

  test("launches a static group by materializing its contacts", async () => {
    const deps = createDeps({ targetContactIds: null, targetGroupId: "group_1" });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).resolves.toMatchObject({
      status: "launched",
      assignmentCount: 2,
    });
  });

  test("does not require compliance identity when List-Unsubscribe is disabled", async () => {
    const deps = createDeps({
      compliance: {
        listUnsubscribeEnabled: false,
      },
    });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).resolves.toMatchObject({ status: "launched" });
  });

  test("requires compliance identity when List-Unsubscribe is enabled", async () => {
    const deps = createDeps({
      compliance: {
        listUnsubscribeEnabled: true,
        physicalAddress: "",
        unsubscribeFooter: "Opt out",
      },
    });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).rejects.toMatchObject({
      issues: [
        "Physical mailing address is required when List-Unsubscribe is enabled",
        "Unsubscribe footer must include {{unsubscribeUrl}} when List-Unsubscribe is enabled",
      ],
    });
  });
});

function createDeps(input?: {
  status?: "draft" | "active" | "paused" | "completed";
  mailboxes?: string[];
  contacts?: ContactRecord[];
  blocked?: Set<string>;
  existingAssignments?: number;
  name?: string;
  steps?: unknown[];
  schedule?: Record<string, unknown>;
  missingCampaign?: boolean;
  targetContactIds?: string[] | null;
  targetGroupId?: string;
  dynamicGroup?: boolean;
  compliance?: {
    listUnsubscribeEnabled?: boolean;
    physicalAddress?: string;
    unsubscribeFooter?: string;
  };
}) {
  const contacts = input?.contacts ?? [
    { id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} },
    { id: "contact_2", orgId: "org_1", email: "grace@example.com", customVars: {} },
  ];
  const deps = {
    campaigns: {
      status: input?.status ?? "draft",
      async getLaunch(id: string, orgId: string) {
        if (input?.missingCampaign) return null;
        return {
          id,
          orgId,
          name: input?.name ?? "Launch",
          status: this.status,
          steps: input?.steps ?? [{ subject: "Hello", body: "Hi" }],
          schedule: input?.schedule ?? {
            daysAllowed: ["monday"],
            startTime: "09:00",
            endTime: "17:00",
          },
          targetContactIds:
            input?.targetContactIds === null
              ? undefined
              : (input?.targetContactIds ?? contacts.map((contact) => contact.id)),
          targetGroupId: input?.targetGroupId,
        };
      },
      async activateDraft() {
        if (this.status !== "draft") return false;
        this.status = "active";
        return true;
      },
    },
    campaignMailboxes: {
      async replaceForCampaign() {
        return { linked: input?.mailboxes?.length ?? 1 };
      },
      async listForCampaign() {
        return input?.mailboxes ?? ["mailbox_1"];
      },
    },
    mailboxes: {
      async listActiveByIds(ids: string[]) {
        const available = input?.mailboxes ?? ["mailbox_1"];
        return ids.filter((id) => available.includes(id)).map((id) => ({ id, orgId: "org_1" }));
      },
    },
    contacts: {
      async listByIds(ids: string[]) {
        return contacts.filter((contact) => ids.includes(contact.id));
      },
    },
    groups: {
      async getById() {
        return {
          id: "group_1",
          orgId: "org_1",
          name: "Group",
          rules: {},
          logic: "AND" as const,
          isDynamic: input?.dynamicGroup ?? false,
          contactIds: contacts.map((contact) => contact.id),
        };
      },
      async resolveContactIds() {
        return contacts.map((contact) => contact.id);
      },
    },
    blocklist: {
      async isBlocked(email: string) {
        return input?.blocked?.has(email) ?? false;
      },
    },
    assignments: {
      async createManyForCampaign(params: { contactIds: string[] }) {
        return {
          created: Math.max(params.contactIds.length - (input?.existingAssignments ?? 0), 0),
          existing: input?.existingAssignments ?? 0,
        };
      },
    },
    compliance: {
      async getSettings() {
        return input?.compliance ?? { listUnsubscribeEnabled: false };
      },
    },
  };
  return deps;
}
