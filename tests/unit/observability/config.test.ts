import { afterEach, describe, expect, test } from "vitest";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("observability config", () => {
  test("disabled mode requires no Better Stack env", async () => {
    process.env.OBSERVABILITY_PROVIDER = "none";
    process.env.OTEL_DEPLOYMENT_ENVIRONMENT = "development";
    delete process.env.BETTER_STACK_SOURCE_TOKEN;
    delete process.env.BETTER_STACK_INGESTING_HOST;

    const { getObservabilityConfig } = await import("../../../src/server/observability/config");

    expect(getObservabilityConfig()).toEqual({
      provider: "none",
      serviceName: "samrian-app",
      serviceVersion: "dev",
      environment: "development",
    });
  });

  test("Better Stack mode requires source token and ingesting host", async () => {
    process.env.OBSERVABILITY_PROVIDER = "betterstack";
    delete process.env.BETTER_STACK_SOURCE_TOKEN;
    delete process.env.BETTER_STACK_INGESTING_HOST;

    const { getObservabilityConfig } = await import("../../../src/server/observability/config");

    expect(() => getObservabilityConfig()).toThrow(
      "Missing Better Stack observability config: BETTER_STACK_SOURCE_TOKEN, BETTER_STACK_INGESTING_HOST"
    );
  });

  test("config errors list missing names without leaking values", async () => {
    process.env.OBSERVABILITY_PROVIDER = "betterstack";
    process.env.BETTER_STACK_SOURCE_TOKEN = "secret-source-token";
    delete process.env.BETTER_STACK_INGESTING_HOST;

    const { getObservabilityConfig } = await import("../../../src/server/observability/config");

    expect(() => getObservabilityConfig()).toThrow("BETTER_STACK_INGESTING_HOST");
    expect(() => getObservabilityConfig()).not.toThrow("secret-source-token");
  });

  test("Better Stack mode builds OTLP endpoints and authorization header from env", async () => {
    process.env.OBSERVABILITY_PROVIDER = "betterstack";
    process.env.BETTER_STACK_SOURCE_TOKEN = "token_123";
    process.env.BETTER_STACK_INGESTING_HOST = "in.logs.betterstack.com";
    process.env.OTEL_SERVICE_NAME = "samrian-worker";
    process.env.OTEL_SERVICE_VERSION = "1.2.3";
    process.env.OTEL_DEPLOYMENT_ENVIRONMENT = "staging";

    const { getObservabilityConfig } = await import("../../../src/server/observability/config");

    expect(getObservabilityConfig()).toEqual({
      provider: "betterstack",
      serviceName: "samrian-worker",
      serviceVersion: "1.2.3",
      environment: "staging",
      ingestingHost: "in.logs.betterstack.com",
      otlpEndpoint: "https://in.logs.betterstack.com",
      otlpHeaders: {
        Authorization: "Bearer token_123",
      },
      sourceToken: "token_123",
    });
  });

  test("explicit OTLP endpoint overrides derived Better Stack endpoint", async () => {
    process.env.OBSERVABILITY_PROVIDER = "betterstack";
    process.env.BETTER_STACK_SOURCE_TOKEN = "token_123";
    process.env.BETTER_STACK_INGESTING_HOST = "in.logs.betterstack.com";
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://collector.example.com";

    const { getObservabilityConfig } = await import("../../../src/server/observability/config");

    expect(getObservabilityConfig()).toMatchObject({
      otlpEndpoint: "https://collector.example.com",
    });
  });

  test("invalid provider throws clear error", async () => {
    process.env.OBSERVABILITY_PROVIDER = "custom";

    const { getObservabilityConfig } = await import("../../../src/server/observability/config");

    expect(() => getObservabilityConfig()).toThrow("Unsupported OBSERVABILITY_PROVIDER: custom");
  });
});
