import { getObservabilityConfig, startOpenTelemetry } from "./src/server/observability";

await startOpenTelemetry(getObservabilityConfig());
