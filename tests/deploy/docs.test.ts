import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

describe("deployment artifacts", () => {
  test("production artifacts use deploy services without local build or secret state", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");
    const dockerignore = await readFile(".dockerignore", "utf8");

    for (const service of ["app:", "postgres:", "redis:", "worker:", "minio:"]) {
      expect(compose).toContain(service);
    }
    expect(compose).toContain("profiles:");
    expect(compose).toContain("samrian-app");
    expect(compose).not.toContain("bun run dev");

    for (const entry of [".next", "node_modules", ".env.local", "*.log"]) {
      expect(dockerignore).toContain(entry);
    }
  });
});
