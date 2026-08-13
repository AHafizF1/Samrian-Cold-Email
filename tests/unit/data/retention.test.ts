import { describe, expect, it } from "vitest";

import { RETENTION } from "../../../src/server/data/retention";

describe("data retention policy", () => {
  it("keeps ephemeral records bounded", () => {
    expect(RETENTION.apiIdempotencyMs).toBe(24 * 60 * 60 * 1000);
    expect(RETENTION.exportsMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    expect(RETENTION.oauthStateMs).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it("defines expiry for derived and deleted data", () => {
    expect(RETENTION.notificationsDays).toBeGreaterThan(0);
    expect(RETENTION.rawEventsDays).toBeGreaterThan(0);
    expect(RETENTION.deletedOrgDays).toBeGreaterThan(0);
    expect(RETENTION.backupDays).toBeGreaterThanOrEqual(RETENTION.deletedOrgDays);
  });
});
