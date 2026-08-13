import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";
import { getTenantDb } from "./tenant";
import type { DbClient } from "./tx";

export type DatabaseDriver = "postgres-js" | "neon-http";

export type DbConfig = {
  driver: DatabaseDriver;
  url: string;
};

export type DbEnv = {
  APP_DATABASE_URL?: string;
  APP_DATABASE_POOL_URL?: string;
  AUTH_DATABASE_URL?: string;
  AUTH_DATABASE_POOL_URL?: string;
  DATABASE_DRIVER?: string;
  DATABASE_URL?: string;
  DATABASE_POOL_URL?: string;
  WORKER_DATABASE_URL?: string;
  WORKER_DATABASE_POOL_URL?: string;
  [key: string]: string | undefined;
};

export type DbPurpose = "app" | "auth" | "worker";

const runtimeClients = new Map<string, DbClient>();

export function readDbConfig(env: DbEnv = process.env, purpose: DbPurpose = "app"): DbConfig {
  const driver = env.DATABASE_DRIVER ?? "postgres-js";
  const runtimeUrls = {
    app: env.APP_DATABASE_POOL_URL || env.APP_DATABASE_URL,
    auth: env.AUTH_DATABASE_POOL_URL || env.AUTH_DATABASE_URL,
    worker: env.WORKER_DATABASE_POOL_URL || env.WORKER_DATABASE_URL,
  };
  const runtimeUrl = runtimeUrls[purpose];
  if (env.NODE_ENV === "production" && !runtimeUrl) {
    const envName = `${purpose.toUpperCase()}_DATABASE_URL`;
    throw new Error(`${envName} is required in production`);
  }
  const url = runtimeUrl || env.DATABASE_POOL_URL || env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  if (driver !== "postgres-js" && driver !== "neon-http") {
    throw new Error(`Unsupported DATABASE_DRIVER: ${driver}`);
  }
  if (env.NODE_ENV === "production" && driver === "neon-http") {
    throw new Error("neon-http does not support required tenant transactions; use postgres-js");
  }

  return { driver, url };
}

export function createDb(config: DbConfig) {
  if (config.driver === "neon-http") {
    return {
      driver: config.driver,
      client: drizzleNeon(neon(config.url), { schema }),
    };
  }

  return {
    driver: config.driver,
    client: drizzlePostgres(postgres(config.url, { max: 10 }), { schema }),
  };
}

export function getDb(env: DbEnv = process.env): DbClient {
  const scoped = getTenantDb();
  if (scoped) return scoped as DbClient;
  return getRuntimeDb("app", env);
}

export function getWorkerDb(env: DbEnv = process.env): DbClient {
  return getRuntimeDb("worker", env);
}

/**
 * Better Auth owns identity tables and must never inherit migration-owner or
 * tenant-app privileges in production. WorkOS mode never calls this function.
 */
export function getAuthDb(env: DbEnv = process.env): DbClient {
  return getRuntimeDb("auth", env);
}

function getRuntimeDb(purpose: DbPurpose, env: DbEnv) {
  const config = readDbConfig(env, purpose);
  const key = `${purpose}:${config.driver}:${config.url}`;
  let client = runtimeClients.get(key);
  if (!client) {
    client = createDb(config).client as DbClient;
    runtimeClients.set(key, client);
  }
  return client;
}
