import crypto from "crypto";

import { getDb } from "../db/db";
import { withTenant } from "../db/tenant";
import { evaluateCampaignHealth } from "./health";
import {
  PostgresAssignmentRepo,
  PostgresBlocklistRepo,
  PostgresCampaignRepo,
  PostgresContactRepo,
  PostgresEventRepo,
  PostgresNotificationRepo,
  PostgresSettingsRepo,
} from "../repos";
import { recordEvent, unsubscribeEvent } from "./events";

type TokenInput = {
  contactId: string;
  campaignId: string;
  orgId: string;
};

export function createUnsubscribeToken(input: TokenInput): string {
  const payload = encode(`${input.orgId}:${input.contactId}:${input.campaignId}`);
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyUnsubscribeToken(token: string, input: Omit<TokenInput, "orgId">) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) {
    throw new Error("Invalid unsubscribe token");
  }

  const [orgId, contactId, campaignId] = decode(payload).split(":");
  if (!orgId || contactId !== input.contactId || campaignId !== input.campaignId) {
    throw new Error("Invalid unsubscribe token");
  }

  return { orgId, contactId, campaignId };
}

export async function unsubscribeContact(input: {
  contactId: string;
  campaignId: string;
  token: string;
}) {
  const verified = verifyUnsubscribeToken(input.token, input);
  const db = getDb();
  return withTenant(db, { orgId: verified.orgId, actorType: "request" }, async (tx) => {
    const contacts = new PostgresContactRepo(tx);
    const assignments = new PostgresAssignmentRepo(tx);
    const blocklist = new PostgresBlocklistRepo(tx);
    const campaigns = new PostgresCampaignRepo(tx);
    const notifications = new PostgresNotificationRepo(tx);
    const settings = new PostgresSettingsRepo(tx);
    const events = new PostgresEventRepo(tx);

    const contact = await contacts.getById(verified.contactId, verified.orgId);
    if (!contact) return { success: false, message: "Contact not found." };

    await blocklist.add({
      orgId: verified.orgId,
      email: contact.email,
      reason: "unsubscribed",
    });

    const assignment = await assignments.getByCampaignAndContact(
      verified.campaignId,
      verified.contactId,
      verified.orgId
    );
    if (assignment) {
      await assignments.updateStatus(assignment.id, verified.orgId, "unsubscribed");
    }

    await recordEvent(
      unsubscribeEvent({
        orgId: verified.orgId,
        campaignId: verified.campaignId,
        contactId: verified.contactId,
        occurredAt: Date.now(),
      }),
      { events }
    );

    const [stats, campaign, compliance] = await Promise.all([
      campaigns.getStats(verified.campaignId),
      campaigns.getById(verified.campaignId, verified.orgId),
      settings.getCompliance(verified.orgId),
    ]);
    if (stats) {
      await evaluateCampaignHealth(
        {
          campaignId: verified.campaignId,
          orgId: verified.orgId,
          campaignName: campaign?.name,
          stats: {
            total: stats.total,
            bounced: stats.bounced,
            unsubscribed: stats.unsubscribed ?? 0,
          },
          thresholds: {
            bouncePauseRate: compliance.bouncePauseRate,
            unsubscribePauseRate: compliance.unsubscribePauseRate,
            minSample: 20,
          },
        },
        { campaigns, notifications }
      );
    }

    return { success: true, message: "Successfully unsubscribed." };
  });
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getTokenSecret()).update(payload).digest("base64url");
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getTokenSecret() {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is required");
  return secret;
}
