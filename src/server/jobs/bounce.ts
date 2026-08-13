import type { BouncePayload, JobRepos } from "./types";
import { classifyBounce } from "../modules/bounces";
import { bounceEvent, recordEvent } from "../modules/events";
import { evaluateCampaignHealth } from "../modules/health";

export { classifyBounce } from "../modules/bounces";

export async function processBounce(
  payload: BouncePayload,
  deps: { repos: JobRepos; bounceRateThreshold: number }
) {
  const bounceType = classifyBounce(payload);
  const contact = await deps.repos.contacts.getById(payload.contactId, payload.orgId);
  if (!contact) {
    return {
      status: "missing" as const,
      messageId: payload.messageId,
      bounceType,
      campaignPaused: false,
    };
  }
  const email = contact.email;

  await deps.repos.contacts.updateBounceStatus(payload.contactId, payload.orgId, bounceType);

  const assignment = await deps.repos.assignments.getByCampaignAndContact(
    payload.campaignId,
    payload.contactId,
    payload.orgId
  );
  if (assignment && assignment.status !== "bounced") {
    await deps.repos.assignments.updateStatus(assignment.id, payload.orgId, "bounced");
  }

  if (bounceType === "hard") {
    await deps.repos.blocklist.add({
      orgId: payload.orgId,
      email,
      reason: "bounced_hard",
    });
  }

  await recordEvent(
    bounceEvent({
      orgId: payload.orgId,
      campaignId: payload.campaignId,
      contactId: payload.contactId,
      messageId: payload.messageId,
      email,
      bounceType,
      dsnCode: payload.dsnCode,
      occurredAt: Date.now(),
    }),
    { events: deps.repos.events }
  );

  const stats = await deps.repos.campaigns.getStats(payload.campaignId);
  const campaign = await deps.repos.campaigns.getById(payload.campaignId, payload.orgId);
  const health = stats
    ? await evaluateCampaignHealth(
        {
          campaignId: payload.campaignId,
          orgId: payload.orgId,
          campaignName: campaign?.name,
          stats: {
            total: stats.total,
            bounced: stats.bounced + 1,
            unsubscribed: stats.unsubscribed ?? 0,
          },
          thresholds: {
            bouncePauseRate: deps.bounceRateThreshold,
            unsubscribePauseRate: 1,
            minSample: 1,
          },
        },
        { campaigns: deps.repos.campaigns, notifications: deps.repos.notifications }
      )
    : { paused: false as const };

  return {
    status: "processed" as const,
    messageId: payload.messageId,
    email,
    bounceType,
    campaignPaused: health.paused,
  };
}
