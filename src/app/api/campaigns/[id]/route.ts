import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresCampaignMailboxRepo, PostgresCampaignRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.campaignRead,
  async ({ orgId, db }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const campaign = await new PostgresCampaignRepo(db)
      .listItems(orgId)
      .then((items) => items.find((item) => item.id === id));
    if (!campaign) return NextResponse.json({ campaign: null });

    const mailboxIds = await new PostgresCampaignMailboxRepo(db).listForCampaign(id, orgId);
    return NextResponse.json({ campaign: { ...campaign, mailboxIds } });
  }
);

export const PATCH = createSessionRoute(
  sessionOperations.campaignUpdate,
  async ({ orgId, db }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = (await request.json()) as { status?: string };

    if (!body.status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    if (body.status === "active") {
      return NextResponse.json(
        { error: "Use the launch endpoint to activate campaigns" },
        { status: 400 }
      );
    }

    await new PostgresCampaignRepo(db).updateStatus(id, orgId, body.status);
    return NextResponse.json({ success: true });
  }
);
