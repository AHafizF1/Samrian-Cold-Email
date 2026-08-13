import { describe, expect, test, vi } from "vitest";

import { createLogger } from "../../../src/server/observability/logs";
import { runWithObservabilityContext } from "../../../src/server/observability/context";

describe("createLogger", () => {
  test("writes structured JSON with context, severity, and redacted metadata", async () => {
    const write = vi.fn();
    const logger = createLogger({
      config: {
        provider: "none",
        serviceName: "samrian-app",
        serviceVersion: "test",
        environment: "test",
      },
      write,
      now: () => 1000,
    });

    await runWithObservabilityContext(
      { requestId: "req_1", correlationId: "corr_1", userId: "user_1", orgId: "org_1" },
      () => {
        logger.info("campaign.launch", {
          route: "/api/campaigns/1/launch",
          action: "launch",
          authorization: "Bearer secret",
        });
      }
    );

    expect(write).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(write.mock.calls[0][0]);
    expect(entry).toMatchObject({
      time: "1970-01-01T00:00:01.000Z",
      level: "info",
      service: "samrian-app",
      version: "test",
      environment: "test",
      event: "campaign.launch",
      requestId: "req_1",
      correlationId: "corr_1",
      userId: "user_1",
      orgId: "org_1",
      route: "/api/campaigns/1/launch",
      action: "launch",
      authorization: "[REDACTED]",
    });
  });

  test("child logger merges static context", () => {
    const write = vi.fn();
    const logger = createLogger({
      config: {
        provider: "none",
        serviceName: "samrian-app",
        serviceVersion: "test",
        environment: "test",
      },
      write,
      now: () => 1000,
    }).child({ provider: "google", jobName: "campaign.send" });

    logger.warn("provider.rate_limited", { outcome: "retry" });

    const entry = JSON.parse(write.mock.calls[0][0]);
    expect(entry).toMatchObject({
      provider: "google",
      jobName: "campaign.send",
      outcome: "retry",
    });
  });
});
