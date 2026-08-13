import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type ObservabilityContext = {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  orgId?: string;
  route?: string;
  method?: string;
  status?: number;
  jobName?: string;
  action?: string;
  provider?: string;
  outcome?: string;
  durationMs?: number;
};

const storage = new AsyncLocalStorage<ObservabilityContext>();

export function getObservabilityContext(): ObservabilityContext {
  return storage.getStore() ?? {};
}

export async function runWithObservabilityContext<T>(
  context: ObservabilityContext,
  fn: () => Promise<T> | T
): Promise<T> {
  const parent = getObservabilityContext();
  const next = normalizeContext({ ...parent, ...context });
  return await storage.run(next, fn);
}

export async function withContext<T>(
  context: ObservabilityContext,
  fn: () => Promise<T> | T
): Promise<T> {
  return await runWithObservabilityContext(context, fn);
}

export function createCorrelationId() {
  return randomUUID();
}

function normalizeContext(context: ObservabilityContext): ObservabilityContext {
  const correlationId = context.correlationId ?? context.requestId ?? createCorrelationId();
  return { ...context, correlationId };
}
