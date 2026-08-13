import crypto from "node:crypto";

import type { EmailEventInput, EventRepo } from "../ports";
import type { RenderedEmail } from "./compliance";

export type TrackingContext = {
  orgId: string;
  campaignId?: string;
  contactId?: string;
  mailboxId?: string;
  assignmentId?: string;
  threadId?: string;
  messageId?: string;
};

export function createTrackingToken(bytes = 18): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function validateTrackedUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Tracked URL must use http or https");
  }
  return url;
}

export function clickEvent(
  input: TrackingContext & { token: string; occurredAt: number; unique?: boolean }
): EmailEventInput {
  return {
    orgId: input.orgId,
    campaignId: input.campaignId,
    contactId: input.contactId,
    mailboxId: input.mailboxId,
    assignmentId: input.assignmentId,
    threadId: input.threadId,
    messageId: input.messageId,
    type: "click",
    dedupeKey: `click:${input.token}:${input.unique === false ? input.occurredAt : "unique"}`,
    occurredAt: input.occurredAt,
    metadata: { unique: input.unique ?? true },
  };
}

export function openEvent(
  input: TrackingContext & { token: string; occurredAt: number; unique?: boolean }
): EmailEventInput {
  return {
    orgId: input.orgId,
    campaignId: input.campaignId,
    contactId: input.contactId,
    mailboxId: input.mailboxId,
    assignmentId: input.assignmentId,
    threadId: input.threadId,
    messageId: input.messageId,
    type: "open",
    dedupeKey: `open:${input.token}:${input.unique === false ? input.occurredAt : "unique"}`,
    occurredAt: input.occurredAt,
    metadata: { unique: input.unique ?? true },
  };
}

export async function applyTracking(input: {
  rendered: RenderedEmail;
  appUrl: string;
  clickTrackingEnabled?: boolean;
  openTrackingEnabled?: boolean;
  context: TrackingContext;
  events?: EventRepo;
}): Promise<RenderedEmail> {
  if (!input.events?.createTrackedLink) return input.rendered;

  let htmlBody = input.rendered.htmlBody;
  if (input.clickTrackingEnabled) {
    htmlBody = await rewriteLinks(htmlBody, {
      appUrl: input.appUrl,
      context: input.context,
      events: input.events,
    });
  }

  if (input.openTrackingEnabled) {
    const token = createTrackingToken();
    await input.events.createTrackedLink({
      ...input.context,
      token,
      originalUrl: `${input.appUrl}/api/track/open/${token}`,
    });
    htmlBody += `<img src="${input.appUrl}/api/track/open/${token}" width="1" height="1" alt="" />`;
  }

  return {
    ...input.rendered,
    htmlBody,
  };
}

async function rewriteLinks(
  inputHtml: string,
  input: {
    appUrl: string;
    context: TrackingContext;
    events: EventRepo;
  }
) {
  const matches = [...inputHtml.matchAll(/href="([^"]+)"/g)];
  let htmlBody = inputHtml;

  for (const match of matches) {
    const originalUrl = match[1];
    if (!originalUrl) continue;
    try {
      validateTrackedUrl(originalUrl);
    } catch {
      continue;
    }

    const token = createTrackingToken();
    await input.events.createTrackedLink?.({
      ...input.context,
      token,
      originalUrl,
    });
    htmlBody = htmlBody.replace(
      `href="${originalUrl}"`,
      `href="${input.appUrl}/api/track/click/${token}"`
    );
  }

  return htmlBody;
}
