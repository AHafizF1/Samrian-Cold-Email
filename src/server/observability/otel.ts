import type { ObservabilityConfig } from "./config";

let started = false;

export async function startOpenTelemetry(config: ObservabilityConfig) {
  if (started || config.provider === "none") return;
  started = true;

  const [
    { OTLPTraceExporter },
    { OTLPLogExporter },
    { resourceFromAttributes },
    { NodeSDK },
    { BatchSpanProcessor },
    { BatchLogRecordProcessor },
  ] = await Promise.all([
    import("@opentelemetry/exporter-trace-otlp-http"),
    import("@opentelemetry/exporter-logs-otlp-http"),
    import("@opentelemetry/resources"),
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/sdk-trace-node"),
    import("@opentelemetry/sdk-logs"),
  ]);

  const resource = resourceFromAttributes({
    "service.name": config.serviceName,
    "service.version": config.serviceVersion,
    "deployment.environment.name": config.environment,
  });
  const headers = config.otlpHeaders;

  const sdk = new NodeSDK({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: `${config.otlpEndpoint}/v1/traces`,
          headers,
        })
      ),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${config.otlpEndpoint}/v1/logs`,
          headers,
        }),
      }),
    ],
  });

  sdk.start();
}
