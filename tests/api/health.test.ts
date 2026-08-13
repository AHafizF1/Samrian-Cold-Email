import { describe, expect, test } from "vitest";

import { buildHealth } from "../../src/server/health";

describe("health status", () => {
  test("returns app, db, jobs, storage, and time without secrets", async () => {
    const health = await buildHealth({
      env: {
        DATABASE_DRIVER: "postgres-js",
        DATABASE_URL: "postgres://user:secret@localhost:5432/samrian",
        JOB_PROVIDER: "bullmq",
        REDIS_URL: "redis://localhost:6379",
        STORAGE_PROVIDER: "s3",
        S3_BUCKET: "samrian",
        S3_ACCESS_KEY_ID: "access",
        S3_SECRET_ACCESS_KEY: "secret",
      },
      checkDb: async () => true,
      now: () => new Date("2026-01-01T00:00:00Z"),
    });

    expect(health).toMatchObject({
      status: "ok",
      service: "samrian-app",
      environment: "test",
      db: { status: "ok", driver: "postgres-js" },
      jobs: { provider: "bullmq" },
      storage: { provider: "s3", bucket: "samrian" },
      time: "2026-01-01T00:00:00.000Z",
    });
    expect(health.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "app", status: "ok", critical: true }),
        expect.objectContaining({ name: "database", status: "ok", critical: true }),
        expect.objectContaining({ name: "auth", status: "ok", critical: true }),
        expect.objectContaining({ name: "jobs", status: "ok", critical: false }),
        expect.objectContaining({ name: "storage", status: "ok", critical: false }),
      ])
    );
    expect(JSON.stringify(health)).not.toContain("secret");
    expect(JSON.stringify(health)).not.toContain("postgres://");
  });

  test("returns degraded when db check fails", async () => {
    const health = await buildHealth({
      env: {
        DATABASE_DRIVER: "postgres-js",
        DATABASE_URL: "postgres://user:secret@localhost:5432/samrian",
        JOB_PROVIDER: "inngest",
        STORAGE_PROVIDER: "s3",
        S3_BUCKET: "samrian",
        S3_ACCESS_KEY_ID: "access",
        S3_SECRET_ACCESS_KEY: "secret",
      },
      checkDb: async () => {
        throw new Error("connection refused");
      },
      now: () => new Date("2026-01-01T00:00:00Z"),
    });

    expect(health.status).toBe("degraded");
    expect(health.db.status).toBe("degraded");
    expect(health.components).toContainEqual(
      expect.objectContaining({ name: "database", status: "degraded" })
    );
    expect(JSON.stringify(health)).not.toContain("connection refused");
  });

  test("degrades invalid auth, jobs, and storage config independently", async () => {
    const health = await buildHealth({
      env: {
        DATABASE_DRIVER: "postgres-js",
        DATABASE_URL: "postgres://user:secret@localhost:5432/samrian",
        AUTH_PROVIDER: "workos",
        JOB_PROVIDER: "bullmq",
        STORAGE_PROVIDER: "s3",
      },
      checkDb: async () => true,
      now: () => new Date("2026-01-01T00:00:00Z"),
    });

    expect(health.status).toBe("degraded");
    expect(health.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "auth", status: "degraded" }),
        expect.objectContaining({ name: "jobs", status: "degraded" }),
        expect.objectContaining({ name: "storage", status: "degraded" }),
      ])
    );
    expect(JSON.stringify(health)).not.toContain("WORKOS_API_KEY");
    expect(JSON.stringify(health)).not.toContain("REDIS_URL");
    expect(JSON.stringify(health)).not.toContain("S3_SECRET_ACCESS_KEY");
  });
});
