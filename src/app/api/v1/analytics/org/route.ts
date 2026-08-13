import { createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { buildStatsSummary } from "@/server/modules/stats";
import { PostgresStatsRepo } from "@/server/repos";

export async function GET(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "analytics.org",
    credentials,
    handler: async ({ principal }) => ({
      data: buildStatsSummary({
        ...(await new PostgresStatsRepo(getDb()).getOrgStats(principal.orgId)),
        openTrackingEnabled: false,
      }),
    }),
  })(request);
}
