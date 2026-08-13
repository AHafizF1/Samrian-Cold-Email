import { describe, expect, test } from "vitest";

import { createDb, getAuthDb, getDb, getWorkerDb, readDbConfig } from "../../src/server/db/db";

describe("db client", () => {
  test("throws clear error when database url is missing", () => {
    expect(() => readDbConfig({ DATABASE_DRIVER: "postgres-js" })).toThrow(
      "DATABASE_URL is required"
    );
  });

  test("throws clear error for unsupported driver", () => {
    expect(() =>
      readDbConfig({
        DATABASE_URL: "postgres://postgres:postgres@localhost:5432/samrian",
        DATABASE_DRIVER: "sqlite",
      })
    ).toThrow("Unsupported DATABASE_DRIVER");
  });

  test("constructs postgres-js and neon-http clients", () => {
    expect(
      createDb({
        driver: "postgres-js",
        url: "postgres://postgres:postgres@localhost:5432/samrian",
      }).driver
    ).toBe("postgres-js");
    expect(
      createDb({
        driver: "neon-http",
        url: "postgres://postgres:postgres@localhost:5432/samrian",
      }).driver
    ).toBe("neon-http");
  });

  test("prefers purpose-specific runtime urls", () => {
    const env = {
      DATABASE_URL: "postgres://migration",
      APP_DATABASE_URL: "postgres://app",
      AUTH_DATABASE_URL: "postgres://auth",
      WORKER_DATABASE_URL: "postgres://worker",
    };

    expect(readDbConfig(env, "app").url).toBe("postgres://app");
    expect(readDbConfig(env, "auth").url).toBe("postgres://auth");
    expect(readDbConfig(env, "worker").url).toBe("postgres://worker");
  });

  test.each([
    ["app" as const, "APP_DATABASE_URL"],
    ["auth" as const, "AUTH_DATABASE_URL"],
    ["worker" as const, "WORKER_DATABASE_URL"],
  ])("requires non-owner %s runtime url in production", (purpose, expectedName) => {
    expect(() =>
      readDbConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://migration-owner" }, purpose)
    ).toThrow(`${expectedName} is required in production`);
  });

  test("rejects neon-http runtime until interactive tenant transactions are supported", () => {
    expect(() =>
      readDbConfig({
        NODE_ENV: "production",
        DATABASE_DRIVER: "neon-http",
        APP_DATABASE_URL: "postgres://app",
      })
    ).toThrow("neon-http does not support required tenant transactions");
  });

  test("reuses one pool per runtime purpose", () => {
    const env = {
      DATABASE_DRIVER: "postgres-js",
      APP_DATABASE_URL: "postgres://app",
      AUTH_DATABASE_URL: "postgres://auth",
      WORKER_DATABASE_URL: "postgres://worker",
    };

    expect(getDb(env)).toBe(getDb(env));
    expect(getAuthDb(env)).toBe(getAuthDb(env));
    expect(getWorkerDb(env)).toBe(getWorkerDb(env));
    expect(getDb(env)).not.toBe(getAuthDb(env));
  });
});
