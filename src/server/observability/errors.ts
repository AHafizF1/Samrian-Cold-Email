import type { Logger, LogFields } from "./logs";
import { redact } from "./redact";

export interface ErrorReporter {
  capture(error: unknown, fields?: LogFields): void;
}

export function createErrorReporter(options: { logger: Pick<Logger, "error"> }): ErrorReporter {
  return {
    capture(error, fields = {}) {
      options.logger.error("error.captured", {
        ...redact(fields),
        error: normalizeError(error),
      });
    },
  };
}

export function createNoopErrorReporter(): ErrorReporter {
  return { capture: () => {} };
}

export function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return redact({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }

  return redact({
    name: "NonError",
    message: String(error),
  });
}
