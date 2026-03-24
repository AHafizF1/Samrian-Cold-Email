/**
 * MicrosoftGraphConnector — Microsoft 365 mailboxes (OAuth2)
 *
 * Send:  Graph API POST /me/sendMail (max 4 concurrent requests per mailbox)
 * Poll:  Graph API GET /me/messages?$filter=isRead eq false, mark as read after fetch
 * Reply: Graph API POST /me/messages/{id}/reply
 * 429:   Parse Retry-After header, exponential backoff (up to 3 retries)
 */

import { refreshAccessToken } from "../../convex/lib/oauth";
import { MailboxConnectionError } from "../../convex/lib/errors";
import type {
  MailboxConnector,
  MailboxRecord,
  OAuthCredentials,
  SendOptions,
  SendResult,
  RawMessage,
} from "./types";

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0/me";
const MAX_CONCURRENT = 4;
const MAX_RETRIES = 3;

export class MicrosoftGraphConnector implements MailboxConnector {
  /** Cached access token */
  private cachedToken: string | null = null;
  /** Expiry timestamp (ms) with 60s buffer already applied */
  private tokenExpiresAt: number = 0;

  /** Semaphore: number of in-flight requests */
  private activeRequests: number = 0;
  /** Queue of resolve callbacks waiting for a slot */
  private waitQueue: Array<() => void> = [];

  constructor(
    private readonly mailbox: MailboxRecord,
    private readonly creds: OAuthCredentials
  ) {
    // Seed cache from stored token if still valid (with 60s buffer)
    if (creds.accessToken && creds.tokenExpiresAt) {
      const buffered = creds.tokenExpiresAt - 60_000;
      if (Date.now() < buffered) {
        this.cachedToken = creds.accessToken;
        this.tokenExpiresAt = buffered;
      }
    }
  }

  // ── Token ────────────────────────────────────────────────────────────────────

  async getFreshAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const { accessToken, expiresIn } = await refreshAccessToken(
      "microsoft",
      this.creds.refreshToken
    );

    this.cachedToken = accessToken;
    // Apply 60s buffer so we refresh before actual expiry
    this.tokenExpiresAt = Date.now() + expiresIn * 1000 - 60_000;

    return accessToken;
  }

  // ── Send ────────────────────────────────────────────────────────────────────

  async send(message: SendOptions): Promise<SendResult> {
    const token = await this.getFreshAccessToken();

    const body = {
      message: {
        subject: message.subject,
        body: {
          contentType: "HTML",
          content: message.html,
        },
        toRecipients: [
          {
            emailAddress: { address: message.to },
          },
        ],
        from: {
          emailAddress: { address: message.from },
        },
        ...(message.inReplyTo && {
          internetMessageHeaders: [
            { name: "In-Reply-To", value: message.inReplyTo },
            ...(message.references?.length
              ? [{ name: "References", value: message.references.join(" ") }]
              : []),
          ],
        }),
      },
      saveToSentItems: true,
    };

    await this.fetchWithThrottle(`${GRAPH_API_BASE}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // Graph API sendMail returns 202 with no body — generate a synthetic Message-ID
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@graph.microsoft.com>`;

    return {
      messageId,
      accepted: [message.to],
      rejected: [],
    };
  }

  // ── Poll ────────────────────────────────────────────────────────────────────

  async pollNewMessages(): Promise<RawMessage[]> {
    const token = await this.getFreshAccessToken();

    const url =
      `${GRAPH_API_BASE}/messages` +
      `?$filter=isRead eq false` +
      `&$top=50` +
      `&$select=id,subject,from,toRecipients,body,receivedDateTime,internetMessageId,internetMessageHeaders`;

    const response = await this.fetchWithThrottle(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = (await response.json()) as {
      value?: GraphMessage[];
    };

    if (!data.value?.length) return [];

    const messages: RawMessage[] = [];

    for (const msg of data.value) {
      const parsed = parseGraphMessage(msg);
      if (parsed) messages.push(parsed);

      // Mark as read
      await this.fetchWithThrottle(`${GRAPH_API_BASE}/messages/${msg.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isRead: true }),
      });
    }

    return messages;
  }

  // ── Reply ───────────────────────────────────────────────────────────────────

  async replyToThread(threadId: string, html: string): Promise<void> {
    const token = await this.getFreshAccessToken();

    await this.fetchWithThrottle(
      `${GRAPH_API_BASE}/messages/${threadId}/reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            body: {
              contentType: "HTML",
              content: html,
            },
          },
        }),
      }
    );
  }

  // ── Close (no-op) ────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    // Stateless HTTP — nothing to close
  }

  // ── Semaphore ────────────────────────────────────────────────────────────────

  /**
   * Acquire a concurrency slot. Waits if MAX_CONCURRENT slots are in use.
   */
  private acquireSlot(): Promise<void> {
    if (this.activeRequests < MAX_CONCURRENT) {
      this.activeRequests++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Release a concurrency slot, unblocking the next waiter if any.
   */
  private releaseSlot(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.activeRequests--;
    }
  }

  // ── Throttle-aware fetch ─────────────────────────────────────────────────────

  /**
   * Fetch with:
   * - Concurrency limit (MAX_CONCURRENT slots)
   * - 429 retry with Retry-After + exponential backoff (up to MAX_RETRIES)
   */
  private async fetchWithThrottle(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    await this.acquireSlot();

    try {
      return await this.fetchWithRetry(url, init, 0);
    } finally {
      this.releaseSlot();
    }
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    attempt: number
  ): Promise<Response> {
    const response = await fetch(url, init);

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfterHeader
        ? parseInt(retryAfterHeader, 10)
        : 0;

      // Exponential backoff: max(Retry-After, 2^attempt) seconds
      const backoffSeconds = Math.max(
        isNaN(retryAfterSeconds) ? 0 : retryAfterSeconds,
        Math.pow(2, attempt)
      );

      await sleep(backoffSeconds * 1000);
      return this.fetchWithRetry(url, init, attempt + 1);
    }

    if (!response.ok && response.status !== 202) {
      const errText = await response.text().catch(() => "");
      throw new MailboxConnectionError(
        `Graph API request failed (${response.status}): ${errText}`,
        "microsoft"
      );
    }

    return response;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Graph API types ───────────────────────────────────────────────────────────

interface GraphEmailAddress {
  address: string;
  name?: string;
}

interface GraphRecipient {
  emailAddress: GraphEmailAddress;
}

interface GraphInternetMessageHeader {
  name: string;
  value: string;
}

interface GraphMessage {
  id: string;
  subject?: string;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  body?: { contentType?: string; content?: string };
  receivedDateTime?: string;
  internetMessageId?: string;
  internetMessageHeaders?: GraphInternetMessageHeader[];
}

/**
 * Parse a Graph API message into a RawMessage.
 */
function parseGraphMessage(msg: GraphMessage): RawMessage | null {
  const from = msg.from?.emailAddress?.address ?? "";
  const to = (msg.toRecipients ?? []).map((r) => r.emailAddress.address);
  const subject = msg.subject ?? "";
  const messageId = msg.internetMessageId ?? `graph-${msg.id}`;

  // Build headers map from internetMessageHeaders
  const headers: Record<string, string> = {};
  for (const h of msg.internetMessageHeaders ?? []) {
    headers[h.name.toLowerCase()] = h.value;
  }

  const inReplyTo = headers["in-reply-to"];
  const referencesRaw = headers["references"];
  const references = referencesRaw
    ? referencesRaw.split(/\s+/).filter(Boolean)
    : undefined;

  const receivedAt = msg.receivedDateTime
    ? new Date(msg.receivedDateTime).getTime()
    : Date.now();

  const isHtml =
    msg.body?.contentType?.toLowerCase() === "html";
  const htmlBody = isHtml ? msg.body?.content : undefined;
  const textBody = !isHtml ? msg.body?.content : undefined;

  return {
    messageId,
    from,
    to,
    subject,
    textBody,
    htmlBody,
    headers,
    inReplyTo,
    references,
    receivedAt,
  };
}
