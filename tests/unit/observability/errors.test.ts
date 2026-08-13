import { describe, expect, test, vi } from "vitest";

import { createErrorReporter } from "../../../src/server/observability/errors";

describe("createErrorReporter", () => {
  test("reports handled errors through logger with redacted context", () => {
    const logger = {
      error: vi.fn(),
    };
    const reporter = createErrorReporter({ logger });

    reporter.capture(new Error("provider failed"), {
      action: "send",
      smtpPassword: "secret",
    });

    expect(logger.error).toHaveBeenCalledWith(
      "error.captured",
      expect.objectContaining({
        action: "send",
        smtpPassword: "[REDACTED]",
        error: expect.objectContaining({
          name: "Error",
          message: "provider failed",
        }),
      })
    );
  });
});
