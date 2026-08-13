import { z } from "zod";
import { createDocument } from "zod-openapi";

export const scopes = [
  "identity:read",
  "contacts:read",
  "contacts:write",
  "blocklist:read",
  "blocklist:write",
  "groups:read",
  "groups:write",
  "campaigns:read",
  "campaigns:write",
  "campaigns:launch",
  "mailboxes:read",
  "mailboxes:check",
  "inbox:read",
  "inbox:reply",
  "analytics:read",
  "domains:read",
  "domains:check",
] as const;

export type Scope = (typeof scopes)[number];

export const scopePresets = {
  "read-only": [
    "identity:read",
    "contacts:read",
    "groups:read",
    "campaigns:read",
    "mailboxes:read",
    "inbox:read",
    "analytics:read",
    "domains:read",
  ],
  operator: [
    "identity:read",
    "contacts:read",
    "contacts:write",
    "blocklist:read",
    "groups:read",
    "groups:write",
    "campaigns:read",
    "campaigns:write",
    "mailboxes:read",
    "mailboxes:check",
    "inbox:read",
    "analytics:read",
    "domains:read",
    "domains:check",
  ],
  sender: [...scopes],
} as const satisfies Record<string, readonly Scope[]>;

export const apiErrorCodes = [
  "UNAUTHENTICATED",
  "INVALID_CREDENTIAL",
  "EXPIRED_CREDENTIAL",
  "REVOKED_CREDENTIAL",
  "FORBIDDEN",
  "MISSING_SCOPE",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "CONFLICT",
  "IDEMPOTENCY_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
  "RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum(apiErrorCodes),
        message: z.string(),
        requestId: z.string(),
        details: z.unknown().optional(),
      })
      .strict(),
  })
  .strict();

export const apiResponseSchema = z
  .object({
    data: z.unknown(),
    meta: z
      .object({
        requestId: z.string(),
        nextCursor: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export type ApiErrorCode = (typeof apiErrorCodes)[number];
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiResponse<T> = { data: T; meta: { requestId: string; nextCursor?: string } };

export type Operation = {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  scopes: readonly Scope[];
  risk: "read" | "write" | "high";
  idempotency: "none" | "required";
  mcp: boolean;
  maxBodyBytes?: number;
  response: z.ZodType;
};

const read = "read" as const;
export const operations: readonly Operation[] = [
  {
    id: "identity.me",
    method: "GET",
    path: "/api/v1/me",
    scopes: ["identity:read"],
    risk: read,
    idempotency: "none",
    mcp: true,
    response: z.lazy(() => meSchema),
  },
  {
    id: "contacts.list",
    method: "GET",
    path: "/api/v1/contacts",
    scopes: ["contacts:read"],
    risk: read,
    idempotency: "none",
    mcp: true,
    response: z.object({ items: z.array(z.lazy(() => contactSchema)) }).strict(),
  },
  {
    id: "contacts.get",
    method: "GET",
    path: "/api/v1/contacts/{id}",
    scopes: ["contacts:read"],
    risk: read,
    idempotency: "none",
    mcp: true,
    response: z.lazy(() => contactSchema),
  },
  {
    id: "contacts.import-preview",
    method: "POST",
    path: "/api/v1/contacts/import/preview",
    scopes: ["contacts:read"],
    risk: read,
    idempotency: "none",
    mcp: true,
    maxBodyBytes: 2 * 1024 * 1024,
    response: z.lazy(() => contactImportReportSchema),
  },
  {
    id: "contacts.import",
    method: "POST",
    path: "/api/v1/contacts/import",
    scopes: ["contacts:write"],
    risk: "write",
    idempotency: "required",
    mcp: true,
    maxBodyBytes: 2 * 1024 * 1024,
    response: z.lazy(() => contactImportReportSchema),
  },
  ...readOperations(),
  {
    id: "campaigns.validate",
    method: "POST",
    path: "/api/v1/campaigns/{id}/validate",
    scopes: ["campaigns:read"],
    risk: read,
    idempotency: "none",
    mcp: true,
    response: z.lazy(() => campaignValidationSchema),
  },
  {
    id: "campaigns.launch",
    method: "POST",
    path: "/api/v1/campaigns/{id}/launch",
    scopes: ["campaigns:launch"],
    risk: "high",
    idempotency: "required",
    mcp: false,
    response: z.lazy(() => campaignLaunchResultSchema),
  },
  {
    id: "inbox.reply",
    method: "POST",
    path: "/api/v1/inbox/threads/{id}/reply",
    scopes: ["inbox:reply"],
    risk: "high",
    idempotency: "required",
    mcp: false,
    response: z.lazy(() => replyResultSchema),
  },
  {
    id: "contacts.update",
    method: "PATCH",
    path: "/api/v1/contacts/{id}",
    scopes: ["contacts:write"],
    risk: "write",
    idempotency: "none",
    mcp: true,
    response: z.lazy(() => contactSchema),
  },
  {
    id: "groups.create",
    method: "POST",
    path: "/api/v1/groups",
    scopes: ["groups:write"],
    risk: "write",
    idempotency: "required",
    mcp: true,
    response: z.lazy(() => groupSchema),
  },
  {
    id: "groups.update",
    method: "PATCH",
    path: "/api/v1/groups/{id}",
    scopes: ["groups:write"],
    risk: "write",
    idempotency: "none",
    mcp: true,
    response: z.lazy(() => groupSchema),
  },
  {
    id: "campaigns.create",
    method: "POST",
    path: "/api/v1/campaigns",
    scopes: ["campaigns:write"],
    risk: "write",
    idempotency: "required",
    mcp: true,
    response: z.object({ id: z.string() }).strict(),
  },
  {
    id: "campaigns.update",
    method: "PATCH",
    path: "/api/v1/campaigns/{id}",
    scopes: ["campaigns:write"],
    risk: "write",
    idempotency: "none",
    mcp: true,
    response: z.object({ id: z.string() }).strict(),
  },
  {
    id: "blocklist.list",
    method: "GET",
    path: "/api/v1/blocklist",
    scopes: ["blocklist:read"],
    risk: "read",
    idempotency: "none",
    mcp: true,
    response: z.lazy(() => blocklistSchema),
  },
  {
    id: "blocklist.add",
    method: "POST",
    path: "/api/v1/blocklist",
    scopes: ["blocklist:write"],
    risk: "write",
    idempotency: "required",
    mcp: false,
    response: z.object({ email: z.email(), reason: z.string() }).strict(),
  },
  {
    id: "blocklist.remove",
    method: "DELETE",
    path: "/api/v1/blocklist/{id}",
    scopes: ["blocklist:write"],
    risk: "write",
    idempotency: "none",
    mcp: false,
    response: z.object({ removed: z.boolean() }).strict(),
  },
  {
    id: "domains.get",
    method: "GET",
    path: "/api/v1/domains/{domain}",
    scopes: ["domains:read"],
    risk: "read",
    idempotency: "none",
    mcp: true,
    response: z.lazy(() => domainSchema.nullable()),
  },
  {
    id: "domains.check",
    method: "POST",
    path: "/api/v1/domains/{domain}/check",
    scopes: ["domains:check"],
    risk: "write",
    idempotency: "none",
    mcp: true,
    response: z.lazy(() => domainSchema),
  },
  {
    id: "capabilities.get",
    method: "GET",
    path: "/api/v1/capabilities",
    scopes: ["identity:read"],
    risk: "read",
    idempotency: "none",
    mcp: true,
    response: z.lazy(() => capabilitiesSchema),
  },
  {
    id: "limits.get",
    method: "GET",
    path: "/api/v1/limits",
    scopes: ["identity:read"],
    risk: "read",
    idempotency: "none",
    mcp: true,
    response: z.lazy(() => limitsSchema),
  },
] as const;

export const meSchema = z
  .object({
    credentialId: z.string(),
    orgId: z.string(),
    userId: z.string().optional(),
    scopes: z.array(z.enum(scopes)),
  })
  .strict();

export const contactSchema = z
  .object({
    id: z.string().min(1),
    email: z.email(),
    domain: z.string().optional(),
    customVars: z.record(z.string(), z.unknown()).optional(),
    timezone: z.string().optional(),
    bounceStatus: z.string().optional(),
    verificationStatus: z.string().optional(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const contactListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export const contactImportSchema = z
  .object({
    contacts: z
      .array(
        z
          .object({
            email: z.string().min(1),
            customVars: z.record(z.string(), z.unknown()).optional(),
            timezone: z.string().optional(),
          })
          .strict()
      )
      .min(1)
      .max(1000),
  })
  .strict();

export const contactImportReportSchema = z
  .object({
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    duplicateRows: z.number().int().nonnegative(),
    invalidRows: z.number().int().nonnegative(),
    blockedRows: z.number().int().nonnegative(),
    hardBouncedRows: z.number().int().nonnegative(),
    unverifiableRows: z.number().int().nonnegative(),
    errors: z.array(
      z.object({ index: z.number().int(), email: z.string(), reason: z.string() }).strict()
    ),
    ids: z.array(z.string()),
  })
  .strict();

export const pageQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();

export const groupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    rules: z.unknown(),
    logic: z.enum(["AND", "OR"]),
    isDynamic: z.boolean(),
    contactIds: z.array(z.string()).optional(),
  })
  .strict();

export const campaignSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    steps: z.array(z.unknown()),
    schedule: z.record(z.string(), z.unknown()).optional(),
    targetGroupId: z.string().optional(),
    targetContactIds: z.array(z.string()).optional(),
    listUnsubscribeEnabled: z.boolean().nullable().optional(),
  })
  .strict();

export const mailboxSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    provider: z.string(),
    email: z.string().optional(),
    status: z.string(),
    dailySendLimit: z.number(),
    emailsSentToday: z.number(),
    lastConnectionTestAt: z.number().optional(),
    lastConnectionError: z.string().optional(),
    providerLimitCode: z.string().optional(),
    providerLimitResetAt: z.number().optional(),
    warmupEnabled: z.boolean(),
    warmupCurrentDailyLimit: z.number().optional(),
  })
  .strict();

export const inboxThreadSchema = z
  .object({
    id: z.string(),
    campaignId: z.string().optional(),
    contactId: z.string().optional(),
    mailboxId: z.string().optional(),
    direction: z.enum(["sent", "received"]).optional(),
    classification: z.string().optional(),
    from: z.string().optional(),
    to: z.array(z.string()).optional(),
    subject: z.string(),
    sentAt: z.number().optional(),
    receivedAt: z.number().optional(),
    unread: z.boolean().optional(),
    displayText: z.string().optional(),
    excerpt: z.string().optional(),
  })
  .strict();

export const statsSchema = z
  .object({
    sent: z.number(),
    failed: z.number(),
    replies: z.number(),
    unsubscribes: z.number(),
    hardBounces: z.number(),
    softBounces: z.number(),
    totalClicks: z.number(),
    uniqueClicks: z.number(),
    totalOpens: z.number(),
    uniqueOpens: z.number(),
    openTrackingEnabled: z.boolean(),
    estimatedOpenRate: z.number().nullable(),
    replyRate: z.number(),
    bounceRate: z.number(),
    unsubscribeRate: z.number(),
    clickRate: z.number(),
  })
  .strict();

export const groupListSchema = z.object({ items: z.array(groupSchema) }).strict();
export const groupPreviewSchema = z
  .object({
    count: z.number(),
    sample: z.array(
      z.object({ id: z.string(), email: z.email(), domain: z.string().optional() }).strict()
    ),
  })
  .strict();
export const campaignListSchema = z.object({ items: z.array(campaignSchema) }).strict();
export const mailboxListSchema = z.object({ items: z.array(mailboxSchema) }).strict();
export const mailboxCheckSchema = z
  .object({
    status: z.string(),
    mailboxId: z.string(),
    issue: z.string().optional(),
    requiresReconnect: z.boolean().optional(),
    providerLimitCode: z.string().optional(),
  })
  .strict();
export const inboxListSchema = z
  .object({ items: z.array(inboxThreadSchema), unreadCount: z.number() })
  .strict();
export const inboxDetailSchema = z
  .object({ thread: inboxThreadSchema, messages: z.array(inboxThreadSchema) })
  .strict();

export const campaignLaunchSchema = z
  .object({ mailboxIds: z.array(z.string().min(1)).min(1).max(100) })
  .strict();
export const campaignLaunchResultSchema = z
  .object({
    status: z.enum(["launched", "already-active"]),
    campaignId: z.string(),
    assignmentCount: z.number().int().nonnegative(),
    createdAssignments: z.number().int().nonnegative(),
    existingAssignments: z.number().int().nonnegative(),
    linkedMailboxCount: z.number().int().nonnegative(),
    skippedContacts: z
      .object({
        blocked: z.number().int().nonnegative(),
        bounced: z.number().int().nonnegative(),
        invalid: z.number().int().nonnegative(),
        missing: z.number().int().nonnegative(),
      })
      .strict(),
    warnings: z.array(z.string()),
  })
  .strict();
export const campaignValidationSchema = z
  .object({
    ready: z.literal(true),
    eligibleContacts: z.number().int().nonnegative(),
    linkedMailboxes: z.number().int().nonnegative(),
    skippedContacts: campaignLaunchResultSchema.shape.skippedContacts,
    warnings: z.array(z.string()),
  })
  .strict();
export const replySchema = z
  .object({ body: z.string().trim().min(1).max(100_000), subject: z.string().max(998).optional() })
  .strict();
export const replyResultSchema = z
  .object({
    status: z.enum(["sent", "duplicate"]),
    threadId: z.string().optional(),
    messageId: z.string().optional(),
  })
  .strict();

export const contactUpdateSchema = z
  .object({
    customVars: z.record(z.string(), z.unknown()).optional(),
    timezone: z.string().nullable().optional(),
  })
  .strict()
  .refine((value) => value.customVars !== undefined || value.timezone !== undefined, {
    message: "At least one field is required",
  });

export const groupWriteSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    rules: z.unknown().default([]),
    logic: z.enum(["AND", "OR"]).default("AND"),
    isDynamic: z.boolean().default(false),
    contactIds: z.array(z.string()).max(10_000).optional(),
  })
  .strict();

export const campaignDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    schedule: z.record(z.string(), z.unknown()),
    steps: z.array(z.unknown()).min(1).max(100),
    targetGroupId: z.string().optional(),
    targetContactIds: z.array(z.string()).max(10_000).optional(),
    mailboxIds: z.array(z.string()).max(100).optional(),
    listUnsubscribeEnabled: z.boolean().nullable().optional(),
  })
  .strict();

export const blocklistEntrySchema = z
  .object({
    id: z.string(),
    email: z.email(),
    reason: z.string().optional(),
    createdAt: z.number(),
  })
  .strict();
export const blocklistSchema = z.object({ items: z.array(blocklistEntrySchema) }).strict();
export const blocklistAddSchema = z
  .object({
    email: z.email(),
    reason: z.enum(["manual", "unsubscribed", "bounced_hard"]).default("manual"),
  })
  .strict();
export const domainSchema = z
  .object({
    domain: z.string(),
    source: z.string(),
    status: z.string(),
    checks: z.unknown(),
    issues: z.array(z.string()),
    warnings: z.array(z.string()),
    checkedAt: z.number(),
    cached: z.boolean().optional(),
  })
  .strict();
export const capabilitiesSchema = z
  .object({
    version: z.literal("v1"),
    operations: z.array(
      z
        .object({
          id: z.string(),
          method: z.enum(["GET", "POST", "PATCH", "DELETE"]),
          path: z.string(),
          scopes: z.array(z.enum(scopes)),
          risk: z.enum(["read", "write", "high"]),
          idempotency: z.enum(["none", "required"]),
          mcp: z.boolean(),
        })
        .strict()
    ),
  })
  .strict();

export const limitsSchema = z
  .object({
    mode: z.enum(["off", "shadow", "enforce"]),
    tier: z.enum(["starter", "pro", "business", "enterprise", "self-hosted"]),
    hourlyUnits: z.number().int().positive(),
    burstUnits: z.number().int().positive(),
    concurrentRequests: z.number().int().positive(),
  })
  .strict();

function readOperations(): Operation[] {
  const specs: Array<[string, string, Scope, z.ZodType]> = [
    ["groups.list", "/api/v1/groups", "groups:read", z.lazy(() => groupListSchema)],
    ["groups.get", "/api/v1/groups/{id}", "groups:read", z.lazy(() => groupSchema)],
    [
      "groups.preview",
      "/api/v1/groups/{id}/preview",
      "groups:read",
      z.lazy(() => groupPreviewSchema),
    ],
    ["campaigns.list", "/api/v1/campaigns", "campaigns:read", z.lazy(() => campaignListSchema)],
    ["campaigns.get", "/api/v1/campaigns/{id}", "campaigns:read", z.lazy(() => campaignSchema)],
    [
      "campaigns.stats",
      "/api/v1/campaigns/{id}/stats",
      "campaigns:read",
      z.lazy(() => statsSchema),
    ],
    ["mailboxes.list", "/api/v1/mailboxes", "mailboxes:read", z.lazy(() => mailboxListSchema)],
    [
      "mailboxes.check",
      "/api/v1/mailboxes/{id}/check",
      "mailboxes:check",
      z.lazy(() => mailboxCheckSchema),
    ],
    ["inbox.list", "/api/v1/inbox", "inbox:read", z.lazy(() => inboxListSchema)],
    ["inbox.get", "/api/v1/inbox/threads/{id}", "inbox:read", z.lazy(() => inboxDetailSchema)],
    ["analytics.org", "/api/v1/analytics/org", "analytics:read", z.lazy(() => statsSchema)],
    [
      "analytics.campaign",
      "/api/v1/analytics/campaigns/{id}",
      "analytics:read",
      z.lazy(() => statsSchema),
    ],
  ];
  return specs.map(([id, path, scope, response]) => ({
    id,
    method: id === "mailboxes.check" ? "POST" : "GET",
    path,
    scopes: [scope],
    risk: id === "mailboxes.check" ? "write" : "read",
    idempotency: "none",
    mcp: true,
    response,
  }));
}

export function getOpenApiDocument() {
  const paths = operations.reduce<Record<string, Record<string, unknown>>>((result, operation) => {
    const item = result[operation.path] ?? {};
    item[operation.method.toLowerCase()] = {
      operationId: operation.id,
      summary: operation.id,
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: "Success" },
        400: { description: "Invalid request" },
        401: { description: "Authentication failed" },
        403: { description: "Scope denied" },
        404: { description: "Not found" },
      },
    };
    result[operation.path] = item;
    return result;
  }, {});

  return createDocument({
    openapi: "3.1.0",
    info: { title: "Samrian Automation API", version: "1.0.0" },
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
    },
  });
}
