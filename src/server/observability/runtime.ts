import { getObservabilityConfig } from "./config";
import { createErrorReporter, createNoopErrorReporter } from "./errors";
import { createLogger, createNoopLogger } from "./logs";
import { createNoopTracer, createTracer } from "./trace";

const config = getObservabilityConfig();

export const logger = config.provider === "none" ? createNoopLogger() : createLogger({ config });
export const errorReporter =
  config.provider === "none" ? createNoopErrorReporter() : createErrorReporter({ logger });
export const tracer = config.provider === "none" ? createNoopTracer() : createTracer({ logger });
