import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { buildStatsSummary } from "@/server/modules/stats";
import { PostgresStatsRepo } from "@/server/repos";

export const GET = createSessionRoute(sessionOperations.analyticsRead, async ({ db, orgId }) => {
  const counts = await new PostgresStatsRepo(db).getOrgStats(orgId);
  const stats = buildStatsSummary({ ...counts, openTrackingEnabled: false });
  return NextResponse.json({
    totalSent: stats.sent,
    estimatedOpenRate: stats.estimatedOpenRate,
    openTrackingEnabled: stats.openTrackingEnabled,
    replyRate: stats.replyRate,
    bounceRate: stats.bounceRate,
    unsubscribeRate: stats.unsubscribeRate,
    clickRate: stats.clickRate,
    activeCampaigns: 0,
  });
});
