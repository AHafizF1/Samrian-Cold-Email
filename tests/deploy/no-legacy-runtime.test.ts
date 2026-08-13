import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const root = process.cwd();
const scannedRoots = [
  "src",
  "lib",
  "inngest",
  "tests",
  "docs",
  "README.md",
  "package.json",
  ".env.example",
  ".gitignore",
  ".prettierignore",
  "eslint.config.mjs",
];

const oldProvider = ["con", "vex"].join("");
const forbidden = [
  new RegExp(oldProvider, "i"),
  new RegExp(`@${oldProvider}`, "i"),
  new RegExp(`${oldProvider}-test`, "i"),
  new RegExp(["use", "Query"].join("")),
  new RegExp(["use", "Mutation"].join("")),
  new RegExp(["api", "queries"].join("\\.")),
  new RegExp(["api", "mutations"].join("\\.")),
  new RegExp(["fetch", "Auth", "Query"].join("")),
  new RegExp(["fetch", "Auth", "Mutation"].join("")),
];

const ignoredDirs = new Set(["node_modules", ".git", ".next", "drizzle"]);

function walk(entry: string): string[] {
  const fullPath = path.join(root, entry);
  if (!existsSync(fullPath)) {
    return [];
  }

  const stat = statSync(fullPath);
  if (stat.isFile()) {
    return [fullPath];
  }

  return readdirSync(fullPath).flatMap((child) => {
    if (ignoredDirs.has(child)) {
      return [];
    }
    return walk(path.join(entry, child));
  });
}

function relative(file: string) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

describe("legacy runtime removal guard", () => {
  test("runtime tree no longer contains old provider files", () => {
    expect(existsSync(path.join(root, oldProvider))).toBe(false);
    expect(existsSync(path.join(root, `.${oldProvider}`))).toBe(false);
  });

  test("active source, tests, docs, env, and package config contain no old provider references", () => {
    const matches = scannedRoots.flatMap((entry) =>
      walk(entry).flatMap((file) => {
        if (relative(file) === "tests/deploy/no-legacy-runtime.test.ts") {
          return [];
        }

        const source = readFileSync(file, "utf8");
        return forbidden
          .filter((pattern) => pattern.test(source))
          .map((pattern) => `${relative(file)} matched ${pattern}`);
      })
    );

    expect(matches).toEqual([]);
  });
});
