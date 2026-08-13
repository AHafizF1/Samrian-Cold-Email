import {
  apiErrorSchema,
  apiResponseSchema,
  contactSchema,
  contactImportReportSchema,
  contactImportSchema,
  contactUpdateSchema,
  groupListSchema,
  groupPreviewSchema,
  groupSchema,
  groupWriteSchema,
  campaignListSchema,
  campaignSchema,
  campaignDraftSchema,
  campaignLaunchSchema,
  campaignLaunchResultSchema,
  campaignValidationSchema,
  mailboxListSchema,
  mailboxCheckSchema,
  inboxListSchema,
  inboxDetailSchema,
  statsSchema,
  replySchema,
  replyResultSchema,
  blocklistSchema,
  blocklistAddSchema,
  domainSchema,
  capabilitiesSchema,
  limitsSchema,
  meSchema,
  type ApiErrorCode,
} from "@samrian/contracts";
import { z } from "zod";
import { validateBaseUrl } from "./origin";

export { validateBaseUrl } from "./origin";

export class SamrianError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorCode | "INVALID_RESPONSE" | "NETWORK_ERROR",
    readonly status?: number,
    readonly requestId?: string
  ) {
    super(message);
  }
}

export type SamrianOptions = {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  createId?: () => string;
  correlationId?: string;
  signal?: AbortSignal;
};

export class Samrian {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly createId: () => string;
  private readonly correlationId: string;
  private readonly signal?: AbortSignal;

  constructor(options: SamrianOptions) {
    this.baseUrl = validateBaseUrl(options.baseUrl);
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetcher = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.correlationId = options.correlationId ?? this.createId();
    this.signal = options.signal;
  }

  readonly identity = {
    me: async () => {
      const response = await this.request("/api/v1/me");
      const parsed = meSchema.safeParse(response.data);
      if (!parsed.success)
        throw new SamrianError(
          "Invalid API response",
          "INVALID_RESPONSE",
          200,
          response.meta.requestId
        );
      return parsed.data;
    },
  };

  capabilities() {
    return this.validated("/api/v1/capabilities", capabilitiesSchema);
  }

  limits() {
    return this.validated("/api/v1/limits", limitsSchema);
  }

  readonly contacts = {
    list: async (input: { limit?: number; cursor?: string } = {}) => {
      const query = new URLSearchParams();
      if (input.limit !== undefined) query.set("limit", String(input.limit));
      if (input.cursor) query.set("cursor", input.cursor);
      const response = await this.request(`/api/v1/contacts${query.size ? `?${query}` : ""}`);
      const parsed = z
        .object({ items: z.array(contactSchema) })
        .strict()
        .safeParse(response.data);
      if (!parsed.success) {
        throw new SamrianError(
          "Invalid API response",
          "INVALID_RESPONSE",
          200,
          response.meta.requestId
        );
      }
      return { ...parsed.data, nextCursor: response.meta.nextCursor };
    },
    iterate: (input: { limit?: number; cursor?: string } = {}) => this.iterateContacts(input),
    get: async (id: string) => {
      const response = await this.request(`/api/v1/contacts/${encodeURIComponent(id)}`);
      const parsed = contactSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new SamrianError(
          "Invalid API response",
          "INVALID_RESPONSE",
          200,
          response.meta.requestId
        );
      }
      return parsed.data;
    },
    import: async (input: unknown, options: { idempotencyKey: string }) => {
      const body = contactImportSchema.parse(input);
      const response = await this.request("/api/v1/contacts/import", {
        method: "POST",
        body,
        idempotencyKey: options.idempotencyKey,
      });
      const parsed = contactImportReportSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new SamrianError(
          "Invalid API response",
          "INVALID_RESPONSE",
          200,
          response.meta.requestId
        );
      }
      return parsed.data;
    },
    previewImport: (input: unknown) =>
      this.validated("/api/v1/contacts/import/preview", contactImportReportSchema, {
        method: "POST",
        body: contactImportSchema.parse(input),
      }),
    update: (id: string, input: unknown) =>
      this.validated(`/api/v1/contacts/${encodeURIComponent(id)}`, contactSchema, {
        method: "PATCH",
        body: contactUpdateSchema.parse(input),
      }),
  };

  private async *iterateContacts(input: { limit?: number; cursor?: string } = {}) {
    let cursor = input.cursor;
    do {
      const page = await this.contacts.list({ limit: input.limit, cursor });
      for (const contact of page.items) yield contact;
      cursor = page.nextCursor;
    } while (cursor);
  }

  readonly groups = {
    list: (input: { limit?: number } = {}) =>
      this.validated(pagePath("/api/v1/groups", input.limit), groupListSchema),
    get: (id: string) => this.validated(`/api/v1/groups/${encodeURIComponent(id)}`, groupSchema),
    preview: (id: string, input: { limit?: number } = {}) =>
      this.validated(
        pagePath(`/api/v1/groups/${encodeURIComponent(id)}/preview`, input.limit),
        groupPreviewSchema
      ),
    create: (input: unknown, options: { idempotencyKey: string }) =>
      this.validated("/api/v1/groups", groupSchema, {
        method: "POST",
        body: groupWriteSchema.parse(input),
        idempotencyKey: options.idempotencyKey,
      }),
    update: (id: string, input: unknown) =>
      this.validated(`/api/v1/groups/${encodeURIComponent(id)}`, groupSchema, {
        method: "PATCH",
        body: groupWriteSchema.parse(input),
      }),
  };

  readonly campaigns = {
    list: (input: { limit?: number } = {}) =>
      this.validated(pagePath("/api/v1/campaigns", input.limit), campaignListSchema),
    get: (id: string) =>
      this.validated(`/api/v1/campaigns/${encodeURIComponent(id)}`, campaignSchema),
    stats: (id: string) =>
      this.validated(`/api/v1/campaigns/${encodeURIComponent(id)}/stats`, statsSchema),
    validate: (id: string, input: unknown) =>
      this.validated(
        `/api/v1/campaigns/${encodeURIComponent(id)}/validate`,
        campaignValidationSchema,
        { method: "POST", body: campaignLaunchSchema.parse(input) }
      ),
    launch: (id: string, input: unknown, options: { idempotencyKey: string }) =>
      this.validated(
        `/api/v1/campaigns/${encodeURIComponent(id)}/launch`,
        campaignLaunchResultSchema,
        {
          method: "POST",
          body: campaignLaunchSchema.parse(input),
          idempotencyKey: options.idempotencyKey,
        }
      ),
    create: (input: unknown, options: { idempotencyKey: string }) =>
      this.validated("/api/v1/campaigns", z.object({ id: z.string() }).strict(), {
        method: "POST",
        body: campaignDraftSchema.parse(input),
        idempotencyKey: options.idempotencyKey,
      }),
    update: (id: string, input: unknown) =>
      this.validated(
        `/api/v1/campaigns/${encodeURIComponent(id)}`,
        z.object({ id: z.string() }).strict(),
        { method: "PATCH", body: campaignDraftSchema.parse(input) }
      ),
  };

  readonly mailboxes = {
    list: (input: { limit?: number } = {}) =>
      this.validated(pagePath("/api/v1/mailboxes", input.limit), mailboxListSchema),
    check: (id: string) =>
      this.validated(`/api/v1/mailboxes/${encodeURIComponent(id)}/check`, mailboxCheckSchema, {
        method: "POST",
      }),
  };

  readonly inbox = {
    list: (input: { limit?: number } = {}) =>
      this.validated(pagePath("/api/v1/inbox", input.limit), inboxListSchema),
    get: (id: string) =>
      this.validated(`/api/v1/inbox/threads/${encodeURIComponent(id)}`, inboxDetailSchema),
    reply: (id: string, input: unknown, options: { idempotencyKey: string }) =>
      this.validated(`/api/v1/inbox/threads/${encodeURIComponent(id)}/reply`, replyResultSchema, {
        method: "POST",
        body: replySchema.parse(input),
        idempotencyKey: options.idempotencyKey,
      }),
  };

  readonly analytics = {
    org: () => this.validated("/api/v1/analytics/org", statsSchema),
    campaign: (id: string) =>
      this.validated(`/api/v1/analytics/campaigns/${encodeURIComponent(id)}`, statsSchema),
  };

  readonly blocklist = {
    list: (input: { limit?: number } = {}) =>
      this.validated(pagePath("/api/v1/blocklist", input.limit), blocklistSchema),
    add: (input: unknown, options: { idempotencyKey: string }) =>
      this.validated(
        "/api/v1/blocklist",
        z.object({ email: z.email(), reason: z.string() }).strict(),
        {
          method: "POST",
          body: blocklistAddSchema.parse(input),
          idempotencyKey: options.idempotencyKey,
        }
      ),
    remove: (id: string) =>
      this.validated(
        `/api/v1/blocklist/${encodeURIComponent(id)}`,
        z.object({ removed: z.boolean() }).strict(),
        { method: "DELETE" }
      ),
  };

  readonly domains = {
    get: (domain: string) =>
      this.validated(`/api/v1/domains/${encodeURIComponent(domain)}`, domainSchema.nullable()),
    check: (domain: string) =>
      this.validated(`/api/v1/domains/${encodeURIComponent(domain)}/check`, domainSchema, {
        method: "POST",
      }),
  };

  private async validated<T>(
    path: string,
    schema: z.ZodType<T>,
    options?: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      body?: unknown;
      idempotencyKey?: string;
    }
  ): Promise<T> {
    const response = await this.request(path, options);
    const parsed = schema.safeParse(response.data);
    if (!parsed.success) {
      throw new SamrianError(
        "Invalid API response",
        "INVALID_RESPONSE",
        200,
        response.meta.requestId
      );
    }
    return parsed.data;
  }

  private async request(
    path: string,
    options: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      body?: unknown;
      idempotencyKey?: string;
    } = {}
  ) {
    const method = options.method ?? "GET";
    const requestId = this.createId();
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const signal = this.signal
          ? AbortSignal.any([controller.signal, this.signal])
          : controller.signal;
        const response = await this.fetcher(`${this.baseUrl}${path}`, {
          headers: {
            authorization: `Bearer ${this.token}`,
            accept: "application/json",
            "user-agent": "@samrian/sdk/0.1.0",
            "x-request-id": requestId,
            "x-correlation-id": this.correlationId,
            ...(options.body === undefined ? {} : { "content-type": "application/json" }),
            ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
          },
          method,
          redirect: "manual",
          ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
          signal,
        });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          if (
            method === "GET" &&
            attempt < 2 &&
            (response.status === 408 || response.status === 429 || response.status >= 500)
          ) {
            await this.sleep(retryDelay(response.headers.get("retry-after"), attempt, this.now));
            continue;
          }
          const error = apiErrorSchema.safeParse(body);
          if (error.success)
            throw new SamrianError(
              error.data.error.message,
              error.data.error.code,
              response.status,
              error.data.error.requestId
            );
          throw new SamrianError("Unexpected API error", "NETWORK_ERROR", response.status);
        }
        const parsed = apiResponseSchema.safeParse(body);
        if (!parsed.success)
          throw new SamrianError("Invalid API response", "INVALID_RESPONSE", response.status);
        return parsed.data;
      } catch (error) {
        if (error instanceof SamrianError) throw error;
        if (this.signal?.aborted) throw new SamrianError("Network request failed", "NETWORK_ERROR");
        if (method === "GET" && attempt < 2) {
          await this.sleep(250 * 2 ** attempt);
          continue;
        }
        throw new SamrianError("Network request failed", "NETWORK_ERROR");
      } finally {
        clearTimeout(timer);
      }
    }
    throw new SamrianError("Network request failed", "NETWORK_ERROR");
  }
}

function retryDelay(value: string | null, attempt: number, now: () => number): number {
  if (value && /^\d+$/.test(value)) return Number(value) * 1000;
  if (value) {
    const at = Date.parse(value);
    if (Number.isFinite(at)) return Math.max(0, at - now());
  }
  return 250 * 2 ** attempt;
}

function pagePath(path: string, limit?: number) {
  return limit === undefined ? path : `${path}?limit=${encodeURIComponent(String(limit))}`;
}
