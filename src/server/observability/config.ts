export type ObservabilityProvider = "none" | "betterstack";

export type ObservabilityConfig =
  | {
      provider: "none";
      serviceName: string;
      serviceVersion: string;
      environment: string;
    }
  | {
      provider: "betterstack";
      serviceName: string;
      serviceVersion: string;
      environment: string;
      ingestingHost: string;
      otlpEndpoint: string;
      otlpHeaders: Record<string, string>;
      sourceToken: string;
    };

const DEFAULT_SERVICE_NAME = "samrian-app";
const DEFAULT_SERVICE_VERSION = "dev";
const DEFAULT_ENVIRONMENT = "development";

export function getObservabilityConfig(env = process.env): ObservabilityConfig {
  const provider = getProvider(env.OBSERVABILITY_PROVIDER);
  const serviceName = env.OTEL_SERVICE_NAME || DEFAULT_SERVICE_NAME;
  const serviceVersion = env.OTEL_SERVICE_VERSION || DEFAULT_SERVICE_VERSION;
  const environment = env.OTEL_DEPLOYMENT_ENVIRONMENT || env.NODE_ENV || DEFAULT_ENVIRONMENT;

  if (provider === "none") {
    return {
      provider,
      serviceName,
      serviceVersion,
      environment,
    };
  }

  const missing = ["BETTER_STACK_SOURCE_TOKEN", "BETTER_STACK_INGESTING_HOST"].filter(
    (key) => !env[key]
  );

  if (missing.length > 0) {
    throw new Error(`Missing Better Stack observability config: ${missing.join(", ")}`);
  }

  const sourceToken = env.BETTER_STACK_SOURCE_TOKEN as string;
  const ingestingHost = normalizeHost(env.BETTER_STACK_INGESTING_HOST as string);

  return {
    provider,
    serviceName,
    serviceVersion,
    environment,
    ingestingHost,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT || `https://${ingestingHost}`,
    otlpHeaders: parseOtelHeaders(env.OTEL_EXPORTER_OTLP_HEADERS, sourceToken),
    sourceToken,
  };
}

function getProvider(value: string | undefined): ObservabilityProvider {
  const provider = value || "none";

  if (provider === "none" || provider === "betterstack") {
    return provider;
  }

  throw new Error(`Unsupported OBSERVABILITY_PROVIDER: ${provider}`);
}

function normalizeHost(host: string): string {
  return host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function parseOtelHeaders(rawHeaders: string | undefined, sourceToken: string) {
  if (!rawHeaders) {
    return { Authorization: `Bearer ${sourceToken}` };
  }

  return Object.fromEntries(
    rawHeaders
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [key, ...valueParts] = entry.split("=");
        return [key, valueParts.join("=")];
      })
  );
}
