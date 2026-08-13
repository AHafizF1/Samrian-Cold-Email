import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

test("migration objects have one owner", async () => {
  const dir = path.resolve("drizzle");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  const owners = new Map<string, string>();
  const duplicates: string[] = [];

  for (const file of files) {
    const sql = await readFile(path.join(dir, file), "utf8");
    const patterns = [
      /CREATE TABLE(?: IF NOT EXISTS)? "([^"]+)"/g,
      /CREATE (?:UNIQUE )?INDEX "([^"]+)"/g,
      /ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)"/g,
    ];

    for (const pattern of patterns) {
      for (const match of sql.matchAll(pattern)) {
        const key = match[2] ? `column:${match[1]}.${match[2]}` : `object:${match[1]}`;
        const owner = owners.get(key);
        if (owner) duplicates.push(`${key} (${owner}, ${file})`);
        else owners.set(key, file);
      }
    }
  }

  expect(duplicates).toEqual([]);
});

test("clean baseline forces RLS for every tenant table", async () => {
  const files = (await readdir(path.resolve("drizzle"))).filter((file) => file.endsWith(".sql"));
  const sql = (
    await Promise.all(files.map((file) => readFile(path.resolve("drizzle", file), "utf8")))
  ).join("\n");
  const { AUTH_TABLES, TENANT_TABLES } = await import("../../src/server/db/rls");

  for (const table of TENANT_TABLES) {
    expect(sql).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    expect(sql).toMatch(
      new RegExp(`CREATE (?:UNIQUE )?INDEX [^\\n]+ ON "${table}"[^\\n]+"org_id"`)
    );
  }
  expect(sql).toContain("tracked_links_app_token_read");
  expect(sql).toContain("CREATE ROLE samrian_app");
  expect(sql).toContain("CREATE ROLE samrian_auth");
  expect(sql).toContain("CREATE ROLE samrian_worker");
  expect(sql).toContain("NOBYPASSRLS");
  expect(sql).not.toContain("ON ALL TABLES IN SCHEMA public TO samrian_worker");
  expect(sql).toContain('ON TABLE "contacts" TO samrian_worker');
  expect(sql).not.toContain('ON TABLE "sessions" TO samrian_worker');
  for (const table of AUTH_TABLES) {
    expect(sql).toContain(`ON TABLE "${table}" TO samrian_auth`);
  }
  for (const table of TENANT_TABLES) {
    expect(sql).not.toContain(`ON TABLE "${table}" TO samrian_auth`);
  }
});
