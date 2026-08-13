import { campaignDraftSchema, pageQuerySchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { saveCampaignDraft } from "@/server/modules/campaigns";
import {
  PostgresCampaignMailboxRepo,
  PostgresCampaignRepo,
  PostgresIdempotencyStore,
} from "@/server/repos";

export async function GET(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "campaigns.list",
    credentials,
    handler: async ({ principal }) => {
      const parsed = pageQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams)
      );
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid page", 400);
      const campaigns = await new PostgresCampaignRepo(getDb()).listItems(
        principal.orgId,
        parsed.data.limit
      );
      return { data: { items: campaigns.map(toCampaign) } };
    },
  })(request);
}

export async function POST(request: Request) {
  const credentials = await getMachineCredential();
  const db = getDb();
  return createApiRoute({
    operation: "campaigns.create",
    credentials,
    idempotency: ({ principal, operation }) =>
      new PostgresIdempotencyStore(db, {
        orgId: principal.orgId,
        credentialId: principal.credentialId,
        operationId: operation.id,
      }),
    handler: async ({ principal, request }) => {
      const parsed = campaignDraftSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid campaign", 400);
      const id = await db.transaction(async (tx) => {
        return saveCampaignDraft(
          { ...parsed.data, orgId: principal.orgId },
          {
            campaigns: new PostgresCampaignRepo(tx),
            campaignMailboxes: new PostgresCampaignMailboxRepo(tx),
          }
        );
      });
      return { data: { id } };
    },
  })(request);
}

function toCampaign(campaign: Awaited<ReturnType<PostgresCampaignRepo["listItems"]>>[number]) {
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    steps: [...campaign.steps],
    schedule: campaign.schedule,
    ...(campaign.targetGroupId ? { targetGroupId: campaign.targetGroupId } : {}),
    ...(campaign.targetContactIds ? { targetContactIds: campaign.targetContactIds } : {}),
    ...(campaign.listUnsubscribeEnabled === undefined
      ? {}
      : { listUnsubscribeEnabled: campaign.listUnsubscribeEnabled }),
  };
}
