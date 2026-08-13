import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import { sessionOperations } from "../../src/server/auth/policy";

describe("session operation policy", () => {
  test("gives every operation a stable access decision", () => {
    const operations = Object.values(sessionOperations);

    expect(operations.length).toBeGreaterThan(20);
    expect(new Set(operations.map((operation) => operation.id)).size).toBe(operations.length);
    expect(
      operations.every(
        (operation) =>
          operation.access === "authenticated" ||
          (operation.access === "permission" && Object.keys(operation.permissions).length === 1)
      )
    ).toBe(true);
  });

  test("requires every session route to reference the policy registry", () => {
    const missing = routeFiles()
      .filter((file) => /createSession(Route|Action)/.test(readFileSync(file, "utf8")))
      .filter((file) => !readFileSync(file, "utf8").includes("sessionOperations."));

    expect(missing).toEqual([]);
  });
});

function routeFiles() {
  return readdirSync(resolve("src/app/api"), { recursive: true })
    .map(String)
    .filter((file) => file.endsWith("route.ts"))
    .map((file) => resolve("src/app/api", file));
}
