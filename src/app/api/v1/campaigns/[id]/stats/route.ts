import { createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { buildStatsSummary } from "@/server/modules/stats";
import { PostgresStatsRepo } from "@/server/repos";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "campaigns.stats",
    credentials,
    handler: async ({ principal }) => {
      const { id } = await context.params;
      const counts = await new PostgresStatsRepo(getDb()).getCampaignStats({
        orgId: principal.orgId,
        campaignId: id,
      });
      return { data: buildStatsSummary({ ...counts, openTrackingEnabled: false }) };
    },
  })(request);
}
