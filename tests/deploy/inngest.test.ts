import { readdir, readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

describe("local Inngest runtime", () => {
  test("uses a pinned official dev server with explicit local mode", async () => {
    const compose = await readFile("docker-compose.inngest.yml", "utf8");

    expect(compose).toContain("inngest/inngest:v1.22.0");
    expect(compose).toContain('INNGEST_DEV: "1"');
    expect(compose).toContain("INNGEST_BASE_URL: http://inngest:8288");
    expect(compose).toContain("http://dev-app:3000/api/inngest");
    expect(compose).toContain("samrian-inngest-node-modules:/app/node_modules");
    expect(compose).toContain("samrian-inngest-next:/app/.next");
    expect(compose).toContain("bun install --frozen-lockfile --linker hoisted");
    expect(compose).toContain("--no-discovery");
  });

  test("exposes one command for starting the local runtime", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["inngest:dev"]).toBe(
      "docker compose -f docker-compose.yml -f docker-compose.inngest.yml up -d dev-app inngest"
    );
  });

  test("keeps the Inngest webhook outside browser session auth", async () => {
    const proxy = await readFile("src/proxy.ts", "utf8");

    expect(proxy).toContain('"/api/inngest"');
  });

  test("does not create a provider queue for jobs that never enqueue", async () => {
    const deps = await readFile("src/server/worker/deps.ts", "utf8");

    expect(deps).not.toContain("const jobs = queue ?? createJobQueue()");
    expect(deps).toContain("const getQueue = () => queue ?? createJobQueue()");
  });

  test("shares one configured account concurrency budget across functions", async () => {
    const files = await readdir("inngest/functions");
    const sources = await Promise.all(
      files
        .filter((file) => file.endsWith(".ts"))
        .map((file) => readFile(`inngest/functions/${file}`, "utf8"))
    );

    const functions = sources.join("\n").match(/inngest\.createFunction\(/g) ?? [];
    const limits = sources.join("\n").match(/concurrency: inngestConcurrency/g) ?? [];

    expect(limits).toHaveLength(functions.length);
  });
});
