import { trace, SpanStatusCode } from "@opentelemetry/api";

import { normalizeError } from "./errors";
import type { Logger, LogFields } from "./logs";

export interface Tracer {
  span<T>(name: string, fields: LogFields, fn: () => Promise<T> | T): Promise<T>;
}

export function createTracer(options: {
  logger: Pick<Logger, "debug" | "error">;
  now?: () => number;
}): Tracer {
  const now = options.now ?? Date.now;
  const otelTracer = trace.getTracer("samrian-app");

  return {
    async span(name, fields, fn) {
      const start = now();
      return await otelTracer.startActiveSpan(name, async (span) => {
        for (const [key, value] of Object.entries(fields)) {
          if (isAttributeValue(value)) span.setAttribute(key, value);
        }

        try {
          const result = await fn();
          const durationMs = now() - start;
          span.setStatus({ code: SpanStatusCode.OK });
          options.logger.debug("trace.span", {
            ...fields,
            spanName: name,
            durationMs,
            outcome: "ok",
          });
          return result;
        } catch (error) {
          const durationMs = now() - start;
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          span.setStatus({ code: SpanStatusCode.ERROR });
          options.logger.error("trace.span_failed", {
            ...fields,
            spanName: name,
            durationMs,
            outcome: "error",
            error: normalizeError(error),
          });
          throw error;
        } finally {
          span.end();
        }
      });
    },
  };
}

export function createNoopTracer(): Tracer {
  return {
    async span(_name, _fields, fn) {
      return await fn();
    },
  };
}

function isAttributeValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
