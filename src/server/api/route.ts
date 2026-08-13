import { operations, type ApiErrorCode, type Operation } from "@samrian/contracts";
import { runIdempotent, type IdempotencyStore } from "./idempotency";
import { getDb } from "../db/db";
import { withTenant } from "../db/tenant";
import type { TenantContext } from "../db/tenant";
import type { DbTransaction } from "../db/tx";
import type { Logger } from "../observability/logs";
import { logger as defaultLogger } from "../observability/runtime";
import { withRequestTelemetry } from "../observability/wrap";
import { getLimitGuard } from "../limits";
import type { GuardDecision, LimitGuard } from "../modules/limits";
import { createHash } from "node:crypto";
import { BodyError, boundRequest } from "../http/body";
import { RateLimitUnavailableError } from "../limits/degraded";
import { getClientIp } from "../limits/http";

import {
  extractBearerCredential,
  hasScopes,
  type AutomationPrincipal,
  type MachineCredential,
} from "../auth/machine";

type ApiRouteContext = {
  request: Request;
  principal: AutomationPrincipal;
  requestId: string;
  correlationId: string;
  operation: Operation;
  tenant<R>(operation: (db: DbTransaction) => Promise<R>): Promise<R>;
};

type ApiRouteOptions<T> = {
  operation: string;
  credentials: MachineCredential;
  handler: (context: ApiRouteContext) => Promise<{ data: T; nextCursor?: string }>;
  idempotency?: (context: ApiRouteContext) => IdempotencyStore;
  logger?: Pick<Logger, "info" | "warn" | "error">;
  tenant?: <R>(context: TenantContext, operation: (db: DbTransaction) => Promise<R>) => Promise<R>;
  transaction?: "handler" | "explicit";
  limits?: LimitGuard;
  bodyLimitBytes?: number;
};

export class ApiRouteError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
  }
}

export function createApiRoute<T>(options: ApiRouteOptions<T>) {
  const operation = findOperation(options.operation);

  return async function route(request: Request): Promise<Response> {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const correlationId = request.headers.get("x-correlation-id") ?? requestId;
    const logger = options.logger ?? defaultLogger;

    return withRequestTelemetry(
      {
        route: operation.path,
        method: request.method,
        requestId,
        correlationId,
        logger,
      },
      async () => {
        const response = await execute();
        response.headers.set("x-request-id", requestId);
        response.headers.set("x-correlation-id", correlationId);
        return response;
      }
    );

    async function execute() {
      try {
        request = await boundRequest(
          request,
          options.bodyLimitBytes ?? operation.maxBodyBytes ?? 64 * 1024
        );
        let value: string;
        try {
          value = extractBearerCredential(request.headers);
        } catch {
          throw new ApiRouteError("UNAUTHENTICATED", "Authentication required", 401);
        }
        const limitGuard = options.limits ?? getLimitGuard();
        const source = getClientIp(
          request.headers,
          process.env.TRUSTED_PROXY_MODE === "single" ? "single" : "none"
        );
        const sourceLimit = await limitGuard.checkSubject({
          operationId: "token.verify",
          subjectType: "ip",
          subject: source,
        });
        if (!sourceLimit.allowed) throw rateLimitError(sourceLimit);
        const tokenSubject = createHash("sha256").update(value).digest("hex").slice(0, 24);
        const tokenLimit = await limitGuard.checkSubject({
          operationId: "token.verify",
          subjectType: "token",
          subject: tokenSubject,
        });
        if (!tokenLimit.allowed) throw rateLimitError(tokenLimit);

        const principal = await options.credentials.verify(value);
        if (!principal) {
          const penalty = await limitGuard.checkSubject({
            operationId: "token.verify",
            subjectType: "token",
            subject: tokenSubject,
            penalty: true,
          });
          logger.warn("credential.rejected", { requestId, reason: "invalid-or-expired" });
          if (!penalty.allowed) throw rateLimitError(penalty);
          throw new ApiRouteError("INVALID_CREDENTIAL", "Invalid API credential", 401);
        }

        if (!hasScopes(principal, operation.scopes)) {
          logger.warn("credential.denied", {
            requestId,
            orgId: principal.orgId,
            credentialId: principal.credentialId,
            operation: operation.id,
          });
          throw new ApiRouteError("MISSING_SCOPE", "Credential lacks required scope", 403);
        }

        const limit = await limitGuard.check({
          operationId: operation.id,
          orgId: principal.orgId,
          credentialId: principal.credentialId,
        });
        if (!limit.allowed) throw rateLimitError(limit);

        logger.info("credential.used", {
          requestId,
          orgId: principal.orgId,
          credentialId: principal.credentialId,
          operation: operation.id,
        });

        const runInTenant =
          options.tenant ??
          (<R>(tenant: TenantContext, operation: (db: DbTransaction) => Promise<R>) =>
            withTenant(getDb(), tenant, operation));
        const tenantContext = {
          orgId: principal.orgId,
          userId: principal.userId,
          actorType: "request",
        } as const;
        const context: ApiRouteContext = {
          request,
          principal,
          requestId,
          correlationId,
          operation,
          tenant: (operation) => runInTenant(tenantContext, operation),
        };
        const executeHandler = async () => {
          let result: { data: T; nextCursor?: string };
          if (operation.idempotency === "required") {
            const key = request.headers.get("idempotency-key")?.trim();
            if (!key || key.length > 200) {
              throw new ApiRouteError("IDEMPOTENCY_REQUIRED", "Idempotency-Key is required", 400);
            }
            if (!options.idempotency) throw new Error("Idempotency store is required");
            const payload = await request
              .clone()
              .json()
              .catch(() => null);
            try {
              const store =
                options.transaction === "explicit"
                  ? scopedStore(context, options.idempotency)
                  : options.idempotency(context);
              result = await runIdempotent({ key, payload }, store, () => options.handler(context));
            } catch (error) {
              if (error instanceof Error && error.message.includes("different payload")) {
                throw new ApiRouteError("IDEMPOTENCY_CONFLICT", error.message, 409);
              }
              if (error instanceof Error && error.message.includes("in progress")) {
                throw new ApiRouteError("CONFLICT", error.message, 409);
              }
              throw error;
            }
          } else {
            result = await options.handler(context);
          }
          const parsed = operation.response.safeParse(result.data);
          if (!parsed.success) {
            throw new ApiRouteError("INTERNAL_ERROR", "Unexpected API response", 500);
          }
          return Response.json({
            data: parsed.data,
            meta: { requestId, ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) },
          });
        };
        return await (options.transaction === "explicit"
          ? executeHandler()
          : context.tenant(() => executeHandler()));
      } catch (error) {
        return errorResponse(error, requestId);
      }
    }
  };
}

function scopedStore(
  context: ApiRouteContext,
  create: NonNullable<ApiRouteOptions<unknown>["idempotency"]>
): IdempotencyStore {
  return {
    get: (key) => context.tenant(() => create(context).get(key)),
    reserve: (key, fingerprint) => context.tenant(() => create(context).reserve(key, fingerprint)),
    complete: (key, result) => context.tenant(() => create(context).complete(key, result)),
  };
}

function findOperation(id: string): Operation {
  const operation = operations.find((item) => item.id === id);
  if (!operation) {
    throw new Error(`Unknown API operation: ${id}`);
  }
  return operation;
}

function errorResponse(error: unknown, requestId: string): Response {
  const apiError =
    error instanceof BodyError
      ? new ApiRouteError("VALIDATION_FAILED", error.message, error.status)
      : error instanceof RateLimitUnavailableError
        ? new ApiRouteError("PROVIDER_UNAVAILABLE", error.message, 503)
        : error instanceof ApiRouteError
          ? error
          : new ApiRouteError("INTERNAL_ERROR", "Unexpected API error", 500);

  const body = {
    error: {
      code: apiError.code,
      message: apiError.message,
      requestId,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
  };

  const response = Response.json(body, { status: apiError.status });
  if (apiError.code === "RATE_LIMITED" && isLimitDetails(apiError.details)) {
    response.headers.set("retry-after", String(apiError.details.retryAfter));
    response.headers.set("ratelimit-policy", apiError.details.policyId);
    response.headers.set("ratelimit-limit", String(apiError.details.limit));
    response.headers.set("ratelimit-remaining", String(apiError.details.remaining));
    response.headers.set(
      "ratelimit-reset",
      String(Math.max(0, Math.ceil((apiError.details.resetAt - Date.now()) / 1000)))
    );
  }
  return response;
}

function rateLimitError(limit: GuardDecision) {
  return new ApiRouteError("RATE_LIMITED", "Rate limit exceeded", 429, {
    policyId: limit.policyId,
    limit: limit.limit,
    remaining: limit.remaining,
    retryAfter: Math.max(1, Math.ceil(limit.retryAfterMs / 1000)),
    resetAt: limit.resetAt,
  });
}

function isLimitDetails(value: unknown): value is {
  policyId: string;
  limit: number;
  remaining: number;
  retryAfter: number;
  resetAt: number;
} {
  return (
    !!value &&
    typeof value === "object" &&
    "policyId" in value &&
    "retryAfter" in value &&
    "limit" in value &&
    "remaining" in value &&
    "resetAt" in value
  );
}
