import { requireOrgAccess } from "../auth/session";
import type { AuthContext, PermissionRequest } from "../auth/types";
import { getOperationPermissions, type SessionOperation } from "../auth/policy";
import { getDb } from "../db/db";
import { withTenant, type TenantContext } from "../db/tenant";
import type { DbClient, DbTransaction } from "../db/tx";
import { getLimitGuard } from "../limits";
import { limitHeaders, rateLimitResponse } from "../limits/http";
import type { LimitGuard } from "../modules/limits";
import type { Logger } from "../observability/logs";
import { logger as defaultLogger } from "../observability/runtime";
import { BodyError, boundRequest } from "../http/body";
import { RateLimitUnavailableError } from "../limits/degraded";

export type SessionRouteContext = AuthContext & { db: DbTransaction };
export type SessionActionContext = AuthContext & {
  tenant<T>(operation: (db: DbTransaction) => Promise<T>): Promise<T>;
};

type SessionRouteDeps = {
  db?: DbClient;
  requireAccess?: (permissions?: PermissionRequest) => Promise<AuthContext>;
  tenant?: <T>(
    db: DbClient,
    context: TenantContext,
    operation: (db: DbTransaction) => Promise<T>
  ) => Promise<T>;
  limits?: LimitGuard;
  operationId?: string;
  penalizeStatuses?: number[];
  logger?: Pick<Logger, "warn">;
  bodyLimitBytes?: number;
};

export function createSessionRoute<Args extends unknown[], Result>(
  operation: SessionOperation,
  handler: (context: SessionRouteContext, ...args: Args) => Promise<Result>,
  deps: SessionRouteDeps = {}
) {
  return async (...args: Args): Promise<Result> => {
    try {
      args = await boundArgs(args, deps.bodyLimitBytes);
    } catch (error) {
      if (error instanceof BodyError) return bodyErrorResponse(error) as Result;
      throw error;
    }
    const operationId = deps.operationId ?? operation.id;
    const auth = await authorizeOperation(operation, operationId, deps);
    const request = args.find((value) => value instanceof Request) as Request | undefined;
    const limit = await checkUserLimit(auth, operationId, deps);
    if (limit instanceof Response) return limit as Result;
    if (!limit.allowed) return rateLimitResponse(limit) as Result;
    const db = deps.db ?? getDb();
    const result = await (deps.tenant ?? withTenant)(
      db,
      { orgId: auth.orgId, userId: auth.userId, actorType: "request" },
      (tx) => handler({ ...auth, db: tx }, ...args)
    );
    if (result instanceof Response) {
      if (deps.penalizeStatuses?.includes(result.status)) {
        await (deps.limits ?? getLimitGuard()).checkSubject({
          operationId,
          subjectType: "user",
          subject: `${auth.orgId}:${auth.userId}`,
          penalty: true,
        });
      }
      for (const [name, value] of Object.entries(limitHeaders(limit))) {
        result.headers.set(name, value);
      }
    }
    return result;
  };
}

export function createSessionAction<Args extends unknown[], Result>(
  operation: SessionOperation,
  handler: (context: SessionActionContext, ...args: Args) => Promise<Result>,
  deps: SessionRouteDeps = {}
) {
  return async (...args: Args): Promise<Result> => {
    try {
      args = await boundArgs(args, deps.bodyLimitBytes);
    } catch (error) {
      if (error instanceof BodyError) return bodyErrorResponse(error) as Result;
      throw error;
    }
    const operationId = deps.operationId ?? operation.id;
    const auth = await authorizeOperation(operation, operationId, deps);
    const limit = await checkUserLimit(auth, operationId, deps);
    if (limit instanceof Response) return limit as Result;
    if (!limit.allowed) return rateLimitResponse(limit) as Result;
    const db = deps.db ?? getDb();
    const runTenant = deps.tenant ?? withTenant;
    const context = { orgId: auth.orgId, userId: auth.userId, actorType: "request" } as const;

    const result = await handler(
      {
        ...auth,
        tenant: (operation) => runTenant(db, context, operation),
      },
      ...args
    );
    if (result instanceof Response) {
      if (deps.penalizeStatuses?.includes(result.status)) {
        await (deps.limits ?? getLimitGuard()).checkSubject({
          operationId: deps.operationId ?? operation.id,
          subjectType: "user",
          subject: `${auth.orgId}:${auth.userId}`,
          penalty: true,
        });
      }
      for (const [name, value] of Object.entries(limitHeaders(limit))) {
        result.headers.set(name, value);
      }
    }
    return result;
  };
}

async function boundArgs<Args extends unknown[]>(args: Args, maxBytes = 64 * 1024): Promise<Args> {
  const index = args.findIndex((value) => value instanceof Request);
  if (index < 0) return args;
  const request = args[index] as Request;
  const bounded = await boundRequest(request, maxBytes);
  const result = [...args];
  result[index] = bounded;
  return result as Args;
}

function bodyErrorResponse(error: BodyError) {
  return Response.json({ error: error.message }, { status: error.status });
}

async function checkUserLimit(auth: AuthContext, operationId: string, deps: SessionRouteDeps) {
  try {
    return await (deps.limits ?? getLimitGuard()).checkSubject({
      operationId,
      subjectType: "user",
      subject: `${auth.orgId}:${auth.userId}`,
    });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return Response.json(
        { error: { code: "PROVIDER_UNAVAILABLE", message: error.message } },
        { status: 503 }
      );
    }
    throw error;
  }
}

async function authorizeOperation(
  operation: SessionOperation,
  operationId: string,
  deps: SessionRouteDeps
) {
  try {
    return await (deps.requireAccess ?? ((value) => requireOrgAccess(undefined, value)))(
      getOperationPermissions(operation)
    );
  } catch (error) {
    (deps.logger ?? defaultLogger).warn("authorization.denied", {
      operationId,
      reason: error instanceof Error ? error.message : "Authorization denied",
    });
    throw error;
  }
}
