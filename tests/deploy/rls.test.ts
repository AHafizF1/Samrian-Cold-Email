import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

describe("RLS deployment roles", () => {
  test("production app, auth, and worker use separate non-owner database URLs", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");

    expect(compose).toContain("APP_DATABASE_URL:");
    expect(compose).toContain("AUTH_DATABASE_URL:");
    expect(compose).toContain("WORKER_DATABASE_URL:");
    expect(compose).not.toMatch(/app:[\s\S]*DATABASE_URL: postgres:\/\/postgres:/);
    expect(compose).not.toMatch(/worker:[\s\S]*DATABASE_URL: postgres:\/\/postgres:/);
  });

  test("disposable HTTP security app also uses non-owner database URLs", async () => {
    const compose = await readFile("docker-compose.security.yml", "utf8");
    const app = compose.slice(compose.indexOf("  app:"), compose.indexOf("  migrate:"));

    expect(app).toContain("APP_DATABASE_URL:");
    expect(app).toContain("AUTH_DATABASE_URL:");
    expect(app).toContain("WORKER_DATABASE_URL:");
    expect(app).not.toMatch(/^\s+DATABASE_URL:/m);
    expect(compose).toContain("scripts/db/init-roles.sh");
  });

  test("postgres bootstrap creates non-bypass runtime logins", async () => {
    const script = await readFile("scripts/db/init-roles.sh", "utf8");

    expect(script).toContain("samrian_app_runtime");
    expect(script).toContain("samrian_auth_runtime");
    expect(script).toContain("samrian_worker_runtime");
    expect(script).toContain("NOBYPASSRLS");
    expect(script).toContain("GRANT samrian_app TO samrian_app_runtime");
    expect(script).toContain("GRANT samrian_auth TO samrian_auth_runtime");
    expect(script).toContain("GRANT samrian_worker TO samrian_worker_runtime");
  });

  test("env example explains migration, auth, app, and worker credentials", async () => {
    const example = await readFile(".env.example", "utf8");

    expect(example).toContain("AUTH_DATABASE_URL=");
    expect(example).toContain("AUTH_DATABASE_POOL_URL=");
    expect(example).toContain("TEST_AUTH_DATABASE_URL=");
    expect(example).toContain("required only when AUTH_PROVIDER=better-auth");
    expect(example).toContain("Do not expose this URL to the running app or worker");
  });

  test("Inngest adapters use shared scoped worker dependencies", async () => {
    const dir = "inngest/functions";
    const files = (await readdir(dir)).filter((file) => file.endsWith(".ts"));
    const sources = await Promise.all(files.map((file) => readFile(path.join(dir, file), "utf8")));

    expect(sources.join("\n")).not.toMatch(/getDb|createPostgresJobRepos|new Postgres/);
  });

  test("Inngest workers run side effects inside durable steps", async () => {
    const files = [
      "sendCampaignEmail.ts",
      "pollMailboxes.ts",
      "processBounce.ts",
      "resetCounters.ts",
      "checkMailboxes.ts",
      "evaluateMailboxRamps.ts",
    ];

    for (const file of files) {
      const source = await readFile(path.join("inngest/functions", file), "utf8");
      expect(source, file).toContain("step.run(");
    }

    const dispatch = await readFile("inngest/functions/dispatchCampaignSends.ts", "utf8");
    expect(dispatch).toContain("createInngestQueue(step)");
  });

  test("tenant API routes enter a shared request context", async () => {
    const root = "src/app/api";
    const files = (await readdir(root, { recursive: true }))
      .filter((file) => file.endsWith("route.ts"))
      .map((file) => String(file));

    for (const file of files) {
      const source = await readFile(path.join(root, file), "utf8");
      if (!source.match(/Postgres[A-Z]|createPostgres/)) continue;
      if (file.startsWith(`v1${path.sep}`)) {
        expect(source, file).toContain("createApiRoute");
      } else if (!file.startsWith(`track${path.sep}`)) {
        expect(source, file).toMatch(/createSession(Route|Action)/);
      }
    }
  });
});
