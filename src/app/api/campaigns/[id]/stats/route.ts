import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { buildStatsSummary } from "@/server/modules/stats";
import { PostgresStatsRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.campaignStats,
  async ({ orgId, db }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const counts = await new PostgresStatsRepo(db).getCampaignStats({
      orgId,
      campaignId: id,
    });
    const stats = buildStatsSummary({ ...counts, openTrackingEnabled: false });
    const totalContacts = stats.sent;
    return NextResponse.json({
      totalContacts,
      emailsSent: stats.sent,
      estimatedOpenRate: stats.estimatedOpenRate,
      openTrackingEnabled: stats.openTrackingEnabled,
      replyRate: stats.replyRate,
      bounceRate: stats.bounceRate,
      unsubscribeRate: stats.unsubscribeRate,
      clickRate: stats.clickRate,
      activeContacts: 0,
      repliedContacts: stats.replies,
      bouncedContacts: stats.hardBounces + stats.softBounces,
      completedContacts: 0,
    });
  }
);
