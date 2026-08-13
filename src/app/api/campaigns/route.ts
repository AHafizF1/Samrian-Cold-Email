import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresCampaignMailboxRepo, PostgresCampaignRepo } from "@/server/repos";
import { CampaignDraftError, saveCampaignDraft } from "@/server/modules/campaigns";

export const GET = createSessionRoute(sessionOperations.campaignList, async ({ orgId, db }) => {
  const campaignRepo = new PostgresCampaignRepo(db);
  const mailboxRepo = new PostgresCampaignMailboxRepo(db);
  const campaigns = await Promise.all(
    (await campaignRepo.listItems(orgId)).map(async (campaign) => ({
      ...campaign,
      mailboxIds: await mailboxRepo.listForCampaign(campaign.id, orgId),
    }))
  );
  return NextResponse.json({ campaigns });
});

export const POST = createSessionRoute(
  sessionOperations.campaignCreate,
  async ({ orgId, db }, request: Request) => {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      schedule?: unknown;
      steps?: unknown[];
      targetGroupId?: string;
      targetContactIds?: string[];
      mailboxIds?: string[];
    };

    if (!body.name || !body.schedule || !body.steps) {
      return NextResponse.json(
        { error: "name, schedule, and steps are required" },
        { status: 400 }
      );
    }
    const { name, schedule, steps } = body;

    let id: string;
    try {
      id = await saveCampaignDraft(
        {
          id: body.id,
          orgId,
          name,
          schedule,
          steps,
          targetGroupId: body.targetGroupId,
          targetContactIds: body.targetContactIds,
          mailboxIds: body.mailboxIds,
        },
        {
          campaigns: new PostgresCampaignRepo(db),
          campaignMailboxes: new PostgresCampaignMailboxRepo(db),
        }
      );
    } catch (error) {
      if (error instanceof CampaignDraftError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.code === "not-found" ? 404 : 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ id });
  }
);
