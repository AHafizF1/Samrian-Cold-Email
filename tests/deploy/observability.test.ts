import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const PRODUCT_PATHS = [
  "src/server/jobs",
  "src/server/modules",
  "src/server/repos",
  "src/app/api",
  "lib",
];

describe("observability foundation", () => {
  test("keeps telemetry SDK and logging mechanics behind observability adapters", async () => {
    const files = await listSource();
    const sdkLeaks: string[] = [];
    const consoleLeaks: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (
        source.includes("@opentelemetry/") &&
        !file.includes("src/server/observability/") &&
        !file.endsWith("instrumentation.ts") &&
        !file.endsWith("instrumentation.node.ts") &&
        !file.includes("tests/")
      ) {
        sdkLeaks.push(file);
      }
      if (
        PRODUCT_PATHS.some((productPath) => file.includes(productPath)) &&
        /console\.(log|warn|error)\(/.test(source)
      ) {
        consoleLeaks.push(file);
      }
    }

    expect({ sdkLeaks, consoleLeaks }).toEqual({ sdkLeaks: [], consoleLeaks: [] });
  }, 15_000);

  test("active docs and source do not hardcode Better Stack secrets or resource IDs", async () => {
    const paths = [
      ".env.example",
      "docs/OBSERVABILITY.md",
      "docs/DEPLOYMENT.md",
      "src/server/observability/config.ts",
    ];

    const matches: string[] = [];

    for (const path of paths) {
      const source = await readFile(path, "utf8").catch(() => "");

      if (/token_[a-z0-9]/i.test(source)) {
        matches.push(`${path} contains token-like value`);
      }

      if (/sp_[a-z0-9]/i.test(source)) {
        matches.push(`${path} contains SQL API password-like value`);
      }

      if (/status_page_id\s*=\s*["']?\d+/i.test(source)) {
        matches.push(`${path} contains numeric status page id`);
      }
    }

    expect(matches).toEqual([]);
  });
});

async function listSource() {
  const run = promisify(execFile);
  const args = ["src", "lib", "tests", "instrumentation.ts", "instrumentation.node.ts"];
  const [{ stdout: tracked }, { stdout: untracked }] = await Promise.all([
    run("git", ["ls-files", ...args]),
    run("git", ["ls-files", "--others", "--exclude-standard", ...args]),
  ]);
  const files = `${tracked}\n${untracked}`
    .split(/\r?\n/)
    .filter((file) => /\.(ts|tsx|js|mjs)$/.test(file));
  const existing: string[] = [];
  await Promise.all(
    [...new Set(files)].map((file) =>
      access(file)
        .then(() => existing.push(file))
        .catch(() => undefined)
    )
  );
  return existing;
}
