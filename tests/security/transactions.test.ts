import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("transaction boundaries", () => {
  test.each([
    ["contacts import", "src/app/api/contacts/route.ts", "createSessionAction"],
    ["domain DNS", "src/app/api/domains/check/route.ts", "createSessionAction"],
    ["analytics export", "src/app/api/analytics/export/route.ts", "createSessionAction"],
    ["manual reply", "src/app/api/inbox/threads/[id]/reply/route.ts", "createSessionAction"],
    ["mailbox check", "src/app/api/mailboxes/[id]/check/route.ts", "createSessionAction"],
    ["mailbox archive", "src/app/api/mailboxes/[id]/route.ts", "createSessionAction"],
    ["v1 contact import", "src/app/api/v1/contacts/import/route.ts", 'transaction: "explicit"'],
    [
      "v1 contact preview",
      "src/app/api/v1/contacts/import/preview/route.ts",
      'transaction: "explicit"',
    ],
    ["v1 domain DNS", "src/app/api/v1/domains/[domain]/check/route.ts", 'transaction: "explicit"'],
    [
      "v1 manual reply",
      "src/app/api/v1/inbox/threads/[id]/reply/route.ts",
      'transaction: "explicit"',
    ],
    ["v1 mailbox check", "src/app/api/v1/mailboxes/[id]/check/route.ts", 'transaction: "explicit"'],
  ])("%s uses explicit short DB units", (_name, file, marker) => {
    expect(readFileSync(resolve(file), "utf8")).toContain(marker);
  });

  test("worker orchestration does not wrap provider and queue workflows in one tenant transaction", () => {
    const source = readFileSync(resolve("src/server/worker/deps.ts"), "utf8");
    expect(source).not.toMatch(/sendCampaign:\s*\([^)]*\)\s*=>\s*withTenant/);
    expect(source).not.toMatch(/pollMailbox:\s*\([^)]*\)\s*=>\s*withTenant/);
    expect(source).not.toMatch(/dispatchDueSends:\s*\([^)]*\)\s*=>\s*withTenant/);
  });
});
