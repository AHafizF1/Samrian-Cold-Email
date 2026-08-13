import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import {
  CampaignLaunchError,
  createCampaignLaunchDeps,
  launchCampaign,
} from "@/server/modules/campaigns";
import { withRequestTelemetry } from "@/server/observability";

const launch = createSessionRoute(
  sessionOperations.campaignLaunch,
  async ({ orgId, db }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { mailboxIds?: string[] };

    try {
      const result = await launchCampaign(
        {
          campaignId: id,
          orgId,
          mailboxIds: Array.isArray(body.mailboxIds) ? body.mailboxIds : [],
        },
        createCampaignLaunchDeps(db)
      );
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof CampaignLaunchError) {
        return NextResponse.json(
          {
            error: error.message,
            issues: error.issues,
            skippedContacts: error.skippedContacts,
          },
          { status: 400 }
        );
      }
      throw error;
    }
  },
  { operationId: "campaigns.launch" }
);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return await withRequestTelemetry(
    {
      route: "/api/campaigns/[id]/launch",
      method: request.method,
      requestId: request.headers.get("x-request-id") ?? undefined,
    },
    () => launch(request, context)
  );
}
