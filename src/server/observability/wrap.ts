import {
  createCorrelationId,
  runWithObservabilityContext,
  type ObservabilityContext,
} from "./context";
import {
  errorReporter as defaultReporter,
  logger as defaultLogger,
  tracer as defaultTracer,
} from "./runtime";
import type { ErrorReporter } from "./errors";
import type { Logger, LogFields } from "./logs";
import type { Tracer } from "./trace";

type TelemetryDeps = {
  logger?: Pick<Logger, "info" | "error">;
  tracer?: Tracer;
  reporter?: ErrorReporter;
};

export async function withRequestTelemetry<T extends Response>(
  input: {
    route: string;
    method: string;
    requestId?: string;
    correlationId?: string;
  } & TelemetryDeps,
  fn: () => Promise<T>
): Promise<T> {
  const logger = input.logger ?? defaultLogger;
  const tracer = input.tracer ?? defaultTracer;
  const reporter = input.reporter ?? defaultReporter;
  const requestId = input.requestId ?? createCorrelationId();
  const context = {
    requestId,
    correlationId: input.correlationId ?? requestId,
    route: input.route,
    method: input.method,
  };

  return await runWithObservabilityContext(context, async () => {
    logger.info("request.start", context);
    try {
      return await tracer.span("request", context, async () => {
        const response = await fn();
        logger.info("request.end", {
          ...context,
          status: response.status,
          outcome: response.status >= 500 ? "error" : "ok",
        });
        return response;
      });
    } catch (error) {
      const fields = { ...context, outcome: "error" };
      reporter.capture(error, fields);
      logger.error("request.failed", { ...fields, error });
      throw error;
    }
  });
}

export async function withJobTelemetry<T>(
  input: {
    jobName: string;
    payload?: Record<string, unknown>;
  } & TelemetryDeps,
  fn: () => Promise<T>
): Promise<T> {
  const logger = input.logger ?? defaultLogger;
  const tracer = input.tracer ?? defaultTracer;
  const reporter = input.reporter ?? defaultReporter;
  const payloadContext = contextFromPayload(input.payload);
  const context = {
    ...payloadContext,
    jobName: input.jobName,
    correlationId: payloadContext.correlationId ?? createCorrelationId(),
  };

  return await runWithObservabilityContext(context, async () => {
    logger.info("job.start", context);
    try {
      return await tracer.span(input.jobName, context, async () => {
        const result = await fn();
        logger.info("job.end", { ...context, outcome: "ok" });
        return result;
      });
    } catch (error) {
      const fields = { ...context, outcome: "error" };
      reporter.capture(error, fields);
      logger.error("job.failed", { ...fields, error });
      throw error;
    }
  });
}

function contextFromPayload(payload: Record<string, unknown> | undefined): ObservabilityContext {
  if (!payload) return {};
  const fields: LogFields = {};

  for (const key of ["orgId", "userId", "requestId", "correlationId", "provider", "action"]) {
    const value = payload[key];
    if (typeof value === "string") {
      fields[key] = value;
    }
  }

  return fields;
}
