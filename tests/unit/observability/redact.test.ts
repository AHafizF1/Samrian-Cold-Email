import { describe, expect, test } from "vitest";

import { redact } from "../../../src/server/observability/redact";

describe("redact", () => {
  test("redacts nested secrets and credential urls without mutating input", () => {
    const input = {
      authorization: "Bearer secret",
      cookie: "session=secret",
      smtpPassword: "smtp-secret",
      nested: {
        workosApiKey: "workos-secret",
        databaseUrl: "postgres://user:pass@example.com/db",
        publicValue: "safe",
      },
      list: [{ redisUrl: "redis://:pass@example.com:6379" }],
    };

    const result = redact(input);

    expect(result).toEqual({
      authorization: "[REDACTED]",
      cookie: "[REDACTED]",
      smtpPassword: "[REDACTED]",
      nested: {
        workosApiKey: "[REDACTED]",
        databaseUrl: "[REDACTED]",
        publicValue: "safe",
      },
      list: [{ redisUrl: "[REDACTED]" }],
    });
    expect(input.nested.publicValue).toBe("safe");
  });

  test("redacts token-like strings in metadata values", () => {
    const result = redact({
      unsubscribeToken: "token-secret",
      trackingToken: "tracking-secret",
      message: "plain text",
    });

    expect(result).toMatchObject({
      unsubscribeToken: "[REDACTED]",
      trackingToken: "[REDACTED]",
      message: "plain text",
    });
  });
});
