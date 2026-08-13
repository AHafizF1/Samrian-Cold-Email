import { describe, expect, test, vi } from "vitest";

import { withJobTelemetry, withRequestTelemetry } from "../../../src/server/observability/wrap";
import { getObservabilityContext } from "../../../src/server/observability/context";

describe("observability wrappers", () => {
  test("request wrapper logs start and end with preserved request id", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const tracer = { span: vi.fn((_name, _fields, fn) => fn()) };
    const reporter = { capture: vi.fn() };

    const response = await withRequestTelemetry(
      {
        route: "/api/test",
        method: "POST",
        requestId: "req_1",
        correlationId: "corr_1",
        logger,
        tracer,
        reporter,
      },
      async () => {
        expect(getObservabilityContext()).toMatchObject({
          requestId: "req_1",
          correlationId: "corr_1",
          route: "/api/test",
          method: "POST",
        });
        return new Response("ok", { status: 201 });
      }
    );

    expect(response.status).toBe(201);
    expect(logger.info).toHaveBeenCalledWith(
      "request.start",
      expect.objectContaining({ route: "/api/test", method: "POST" })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "request.end",
      expect.objectContaining({ status: 201, outcome: "ok" })
    );
  });

  test("job wrapper captures failed jobs and rethrows", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const tracer = { span: vi.fn((_name, _fields, fn) => fn()) };
    const reporter = { capture: vi.fn() };

    await expect(
      withJobTelemetry(
        {
          jobName: "campaign.send",
          payload: { orgId: "org_1", correlationId: "corr_1" },
          logger,
          tracer,
          reporter,
        },
        async () => {
          expect(getObservabilityContext()).toMatchObject({
            jobName: "campaign.send",
            orgId: "org_1",
            correlationId: "corr_1",
          });
          throw new Error("provider failed");
        }
      )
    ).rejects.toThrow("provider failed");

    expect(reporter.capture).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ jobName: "campaign.send", outcome: "error" })
    );
    expect(logger.error).toHaveBeenCalledWith(
      "job.failed",
      expect.objectContaining({ jobName: "campaign.send", outcome: "error" })
    );
  });
});
