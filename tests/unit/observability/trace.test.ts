import { describe, expect, test, vi } from "vitest";

import { createTracer } from "../../../src/server/observability/trace";

describe("createTracer", () => {
  test("wraps successful work with duration and span attributes", async () => {
    const logger = { debug: vi.fn(), error: vi.fn() };
    const tracer = createTracer({
      logger,
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(175),
    });

    const result = await tracer.span(
      "campaign.send",
      { jobName: "campaign.send" },
      async () => "sent"
    );

    expect(result).toBe("sent");
    expect(logger.debug).toHaveBeenCalledWith(
      "trace.span",
      expect.objectContaining({
        spanName: "campaign.send",
        jobName: "campaign.send",
        durationMs: 75,
        outcome: "ok",
      })
    );
  });

  test("logs failed spans and rethrows", async () => {
    const logger = { debug: vi.fn(), error: vi.fn() };
    const tracer = createTracer({
      logger,
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(130),
    });

    await expect(
      tracer.span("campaign.send", { jobName: "campaign.send" }, async () => {
        throw new Error("failed");
      })
    ).rejects.toThrow("failed");

    expect(logger.error).toHaveBeenCalledWith(
      "trace.span_failed",
      expect.objectContaining({
        spanName: "campaign.send",
        durationMs: 30,
        outcome: "error",
      })
    );
  });
});
