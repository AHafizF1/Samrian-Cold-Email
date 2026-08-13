import { describe, expect, it } from "vitest";

import { auditDataProtection } from "../../../src/server/data/protection";

describe("deployment data protection audit", () => {
  it("reports insecure production links by env name without values", () => {
    const result = auditDataProtection({
      NEXT_PUBLIC_APP_URL: "http://app.example.com",
      APP_DATABASE_URL: "postgres://user:secret@db.example.com/samrian",
      JOB_PROVIDER: "bullmq",
      REDIS_URL: "redis://cache.example.com:6379",
      S3_ENDPOINT: "http://objects.example.com",
      OBSERVABILITY_PROVIDER: "betterstack",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://telemetry.example.com",
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_APP_URL must use HTTPS",
        "APP_DATABASE_URL must require TLS",
        "REDIS_URL must use rediss",
        "S3_ENDPOINT must use HTTPS",
        "OTEL_EXPORTER_OTLP_ENDPOINT must use HTTPS",
      ])
    );
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("accepts verified production transport settings", () => {
    expect(
      auditDataProtection({
        NEXT_PUBLIC_APP_URL: "https://app.example.com",
        APP_DATABASE_URL: "postgres://runtime@db.example.com/samrian?sslmode=verify-full",
        JOB_PROVIDER: "bullmq",
        REDIS_URL: "rediss://cache.example.com:6379",
        S3_ENDPOINT: "https://objects.example.com",
        OBSERVABILITY_PROVIDER: "betterstack",
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://telemetry.example.com",
      })
    ).toEqual({ ok: true, issues: [] });
  });
});
