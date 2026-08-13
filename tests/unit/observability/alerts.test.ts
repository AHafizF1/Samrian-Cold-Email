import { describe, expect, test } from "vitest";

import {
  INCIDENT_METADATA_KEYS,
  MONITOR_SPECS,
  SEVERITY_MAP,
  STATUS_COMPONENTS,
} from "../../../src/server/observability/alerts";

describe("Better Stack alert manifest", () => {
  test("defines launch-critical uptime monitors", () => {
    expect(MONITOR_SPECS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Samrian Home", path: "/", expectedStatus: 200 }),
        expect.objectContaining({
          name: "Samrian Health",
          path: "/api/health",
          expectedStatus: 200,
          keyword: '"status":"ok"',
        }),
        expect.objectContaining({ name: "Samrian Auth Session", path: "/api/auth/session" }),
        expect.objectContaining({
          name: "Samrian Unsubscribe",
          path: "/api/unsubscribe",
          expectedStatus: 400,
        }),
        expect.objectContaining({
          name: "Samrian Click Tracking",
          path: "/api/track/click/missing",
          expectedStatus: 404,
        }),
        expect.objectContaining({
          name: "Samrian Open Tracking",
          path: "/api/track/open/missing",
          expectedStatus: 404,
        }),
      ])
    );
  });

  test("defines stable status page components", () => {
    expect(STATUS_COMPONENTS.map((component) => component.name)).toEqual([
      "App",
      "API",
      "Auth",
      "Database",
      "Queue/Workers",
      "Email Sending",
      "Inbox Polling",
      "Tracking",
      "Storage",
    ]);
  });

  test("defines incident severity map and metadata keys", () => {
    expect(Object.keys(SEVERITY_MAP)).toEqual(["P1", "P2", "P3", "P4"]);
    expect(SEVERITY_MAP.P1).toMatchObject({
      label: "Critical",
      notify: "page",
    });
    expect(SEVERITY_MAP.P4).toMatchObject({
      label: "Maintenance",
      notify: "ticket",
    });
    expect(INCIDENT_METADATA_KEYS).toEqual([
      "environment",
      "service",
      "route",
      "jobName",
      "orgId",
      "traceId",
      "correlationId",
    ]);
  });

  test("manifest contains no secrets or resource ids", () => {
    const source = JSON.stringify({ MONITOR_SPECS, STATUS_COMPONENTS, SEVERITY_MAP });

    expect(source).not.toMatch(/token_[a-z0-9]/i);
    expect(source).not.toMatch(/bearer\s+[a-z0-9]/i);
    expect(source).not.toMatch(/status_page_id/i);
  });
});
