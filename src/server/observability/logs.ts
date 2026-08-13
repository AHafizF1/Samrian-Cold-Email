import type { ObservabilityConfig } from "./config";
import { getObservabilityContext, type ObservabilityContext } from "./context";
import { redact } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = ObservabilityContext & Record<string, unknown>;

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export type LoggerOptions = {
  config: ObservabilityConfig;
  write?: (line: string) => void;
  now?: () => number;
  base?: LogFields;
};

export function createLogger(options: LoggerOptions): Logger {
  const write = options.write ?? ((line) => process.stdout.write(`${line}\n`));
  const now = options.now ?? Date.now;
  const base = options.base ?? {};

  function emit(level: LogLevel, event: string, fields: LogFields = {}) {
    const entry = redact({
      time: new Date(now()).toISOString(),
      level,
      service: options.config.serviceName,
      version: options.config.serviceVersion,
      environment: options.config.environment,
      event,
      ...getObservabilityContext(),
      ...base,
      ...fields,
    });

    write(JSON.stringify(entry));
  }

  return {
    debug: (event, fields) => emit("debug", event, fields),
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
    child(fields) {
      return createLogger({
        ...options,
        base: { ...base, ...fields },
      });
    },
  };
}

export function createNoopLogger(): Logger {
  const noop = () => {};
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    child: () => createNoopLogger(),
  };
}
