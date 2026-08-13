import { describe, expect, test } from "vitest";

import {
  DOCKER_MONITORING_TARGETS,
  MANAGED_MONITORING_SOURCES,
  WAREHOUSE_QUERIES,
} from "../../../src/server/observability/infra";

describe("observability infra manifest", () => {
  test("defines Docker and VPS monitoring targets", () => {
    expect(DOCKER_MONITORING_TARGETS.map((target) => target.name)).toEqual([
      "host",
      "app-container",
      "worker-container",
      "postgres",
      "redis",
      "storage",
    ]);

    expect(DOCKER_MONITORING_TARGETS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "postgres",
          signals: expect.arrayContaining(["connections", "latency"]),
        }),
        expect.objectContaining({
          name: "redis",
          signals: expect.arrayContaining(["memory", "latency"]),
        }),
        expect.objectContaining({
          name: "worker-container",
          signals: expect.arrayContaining(["job-lag"]),
        }),
      ])
    );
  });

  test("defines managed provider monitoring sources", () => {
    expect(MANAGED_MONITORING_SOURCES.map((source) => source.name)).toEqual([
      "vercel-runtime",
      "neon-or-supabase-postgres",
      "inngest",
      "s3-or-r2",
    ]);
  });

  test("defines warehouse query catalog for launch, security, and incident review", () => {
    expect(WAREHOUSE_QUERIES.map((query) => query.name)).toEqual([
      "error-rate",
      "slow-routes",
      "send-failures",
      "provider-failures",
      "auth-failures",
      "queue-lag",
      "scan-time-4xx-5xx",
    ]);

    for (const query of WAREHOUSE_QUERIES) {
      expect(query.sql).toContain("SELECT");
      expect(query.purpose).toMatch(/launch|security|incident/i);
    }
  });

  test("manifest has no secrets, endpoints, or resource ids", () => {
    const source = JSON.stringify({
      DOCKER_MONITORING_TARGETS,
      MANAGED_MONITORING_SOURCES,
      WAREHOUSE_QUERIES,
    });

    expect(source).not.toMatch(/token_[a-z0-9]/i);
    expect(source).not.toMatch(/https?:\/\//i);
    expect(source).not.toMatch(/password|secret|api[_-]?key/i);
    expect(source).not.toMatch(/status_page_id|monitor_id|collector_id/i);
  });
});
