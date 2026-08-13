import { sql } from "drizzle-orm";

import { readDbConfig, getDb, type DbEnv } from "./db/db";
import { getObservabilityConfig } from "./observability/config";
import { readQueueConfig, type QueueEnv } from "./queue";
import { readStorageConfig, type StorageEnv } from "./storage";

export type HealthStatus = "ok" | "degraded";

export type HealthComponent = {
  name: "app" | "database" | "auth" | "jobs" | "storage";
  status: HealthStatus;
  critical: boolean;
  detail?: string;
};

export type HealthResult = {
  status: HealthStatus;
  service: string;
  version: string;
  environment: string;
  time: string;
  components: HealthComponent[];
  db: {
    status: HealthStatus;
    driver?: string;
    component?: HealthComponent;
  };
  jobs: {
    provider: string;
    component?: HealthComponent;
  };
  storage: {
    provider: string;
    bucket?: string;
    component?: HealthComponent;
  };
};

type HealthEnv = DbEnv & QueueEnv & StorageEnv;

type HealthDeps = {
  env?: HealthEnv;
  checkDb?: () => Promise<boolean>;
  now?: () => Date;
};

export async function buildHealth(deps: HealthDeps = {}): Promise<HealthResult> {
  const env = deps.env ?? process.env;
  const time = (deps.now ?? (() => new Date()))().toISOString();
  const observability = getObservabilityConfig({ ...process.env, ...env });
  const app = readAppHealth();
  const db = await readDbHealth(env, deps.checkDb);
  const auth = readAuthHealth(env);
  const jobs = readJobHealth(env);
  const storage = readStorageHealth(env);
  const components: HealthComponent[] = [
    app,
    db.component,
    auth.component,
    jobs.component,
    storage.component,
  ];

  return {
    status: components.every((component) => component.status === "ok") ? "ok" : "degraded",
    service: observability.serviceName,
    version: observability.serviceVersion,
    environment: observability.environment,
    time,
    components,
    db,
    jobs,
    storage,
  };
}

function readAppHealth(): HealthComponent {
  return { name: "app", status: "ok", critical: true };
}

async function readDbHealth(env: HealthEnv, checkDb?: () => Promise<boolean>) {
  try {
    const config = readDbConfig(env);
    if (checkDb) {
      await checkDb();
    } else {
      await getDb(env).execute(sql`select 1`);
    }

    return {
      status: "ok" as const,
      driver: config.driver,
      component: {
        name: "database",
        status: "ok",
        critical: true,
        detail: config.driver,
      } satisfies HealthComponent,
    };
  } catch {
    return {
      status: "degraded" as const,
      component: {
        name: "database",
        status: "degraded",
        critical: true,
      } satisfies HealthComponent,
    };
  }
}

function readAuthHealth(env: HealthEnv) {
  try {
    const provider = getAuthProviderNameFromEnv(env);
    if (provider === "workos") {
      const missing = [
        "WORKOS_API_KEY",
        "WORKOS_CLIENT_ID",
        "WORKOS_COOKIE_PASSWORD",
        "NEXT_PUBLIC_WORKOS_REDIRECT_URI",
      ].filter((key) => !env[key]);
      if (missing.length > 0) throw new Error("missing WorkOS config");
    }
    return {
      provider,
      component: {
        name: "auth",
        status: "ok",
        critical: true,
        detail: provider,
      } satisfies HealthComponent,
    };
  } catch {
    return {
      provider: "unknown",
      component: {
        name: "auth",
        status: "degraded",
        critical: true,
      } satisfies HealthComponent,
    };
  }
}

function readJobHealth(env: HealthEnv) {
  try {
    const config = readQueueConfig(env);
    return {
      provider: config.provider,
      component: {
        name: "jobs",
        status: "ok",
        critical: false,
        detail: config.provider,
      } satisfies HealthComponent,
    };
  } catch {
    return {
      provider: "unknown",
      component: {
        name: "jobs",
        status: "degraded",
        critical: false,
      } satisfies HealthComponent,
    };
  }
}

function readStorageHealth(env: HealthEnv) {
  try {
    const config = readStorageConfig(env);
    return {
      provider: config.provider,
      bucket: config.bucket,
      component: {
        name: "storage",
        status: "ok",
        critical: false,
        detail: config.provider,
      } satisfies HealthComponent,
    };
  } catch {
    return {
      provider: "unknown",
      component: {
        name: "storage",
        status: "degraded",
        critical: false,
      } satisfies HealthComponent,
    };
  }
}

function getAuthProviderNameFromEnv(env: HealthEnv) {
  const provider = env.AUTH_PROVIDER ?? "better-auth";
  if (provider === "better-auth" || provider === "workos") return provider;
  throw new Error("unsupported auth provider");
}
