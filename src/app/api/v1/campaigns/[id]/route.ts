import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { PostgresCampaignRepo } from "@/server/repos";
import { PostgresCampaignMailboxRepo } from "@/server/repos";
import { CampaignDraftError, saveCampaignDraft } from "@/server/modules/campaigns";
import { campaignDraftSchema } from "@samrian/contracts";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "campaigns.get",
    credentials,
    handler: async ({ principal }) => {
      const { id } = await context.params;
      const campaign = await new PostgresCampaignRepo(getDb()).getLaunch(id, principal.orgId);
      if (!campaign) throw new ApiRouteError("NOT_FOUND", "Campaign not found", 404);
      return {
        data: {
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
        },
      };
    },
  })(request);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "campaigns.update",
    credentials,
    handler: async ({ principal, request }) => {
      const parsed = campaignDraftSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid campaign", 400);
      const { id } = await context.params;
      const db = getDb();
      try {
        await db.transaction((tx) =>
          saveCampaignDraft(
            { ...parsed.data, id, orgId: principal.orgId },
            {
              campaigns: new PostgresCampaignRepo(tx),
              campaignMailboxes: new PostgresCampaignMailboxRepo(tx),
            }
          )
        );
      } catch (error) {
        if (error instanceof CampaignDraftError) {
          throw new ApiRouteError(
            error.code === "not-found" ? "NOT_FOUND" : "CONFLICT",
            error.message,
            error.code === "not-found" ? 404 : 409
          );
        }
        throw error;
      }
      return { data: { id } };
    },
  })(request);
}
