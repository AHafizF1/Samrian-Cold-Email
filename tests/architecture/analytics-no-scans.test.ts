import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("analytics architecture", () => {
  test("dashboard analytics repo does not scan operational tables", () => {
    const files = [
      "src/server/repos/events.ts",
      "src/app/api/analytics/org/route.ts",
      "src/app/api/campaigns/[id]/stats/route.ts",
    ];
    const source = files.map((file) => readFileSync(join(root, file), "utf8")).join("\n");

    expect(source).not.toMatch(/from\(contactAssignments\)/);
    expect(source).not.toMatch(/from\(threads\)/);
    expect(source).not.toMatch(/from\(mailboxes\)/);
  });
});
