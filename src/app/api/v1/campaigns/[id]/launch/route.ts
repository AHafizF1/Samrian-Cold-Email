import { campaignLaunchSchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import {
  CampaignLaunchError,
  createCampaignLaunchDeps,
  launchCampaign,
} from "@/server/modules/campaigns";
import { PostgresIdempotencyStore } from "@/server/repos";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  const db = getDb();
  return createApiRoute({
    operation: "campaigns.launch",
    credentials,
    idempotency: ({ principal, operation }) =>
      new PostgresIdempotencyStore(db, {
        orgId: principal.orgId,
        credentialId: principal.credentialId,
        operationId: operation.id,
      }),
    handler: async ({ principal, request }) => {
      const parsed = campaignLaunchSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) {
        throw new ApiRouteError("VALIDATION_FAILED", "Invalid campaign launch", 400);
      }
      const { id } = await context.params;
      try {
        const data = await db.transaction((tx) =>
          launchCampaign(
            { campaignId: id, orgId: principal.orgId, mailboxIds: parsed.data.mailboxIds },
            createCampaignLaunchDeps(tx)
          )
        );
        return { data };
      } catch (error) {
        if (error instanceof CampaignLaunchError) {
          throw new ApiRouteError("VALIDATION_FAILED", error.message, 422, {
            issues: error.issues,
            skippedContacts: error.skippedContacts,
          });
        }
        throw error;
      }
    },
  })(request);
}
