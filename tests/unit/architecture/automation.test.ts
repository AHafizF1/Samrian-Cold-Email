import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("automation package boundaries", () => {
  it("keeps contracts provider and runtime neutral", () => {
    const source = read("packages/contracts/src/index.ts");

    expect(source).not.toMatch(/from ["'](?:next|drizzle-orm|better-auth|@workos-inc|bullmq)/);
  });

  it("keeps SDK dependent on public contracts only", () => {
    const source = read("packages/sdk/src/index.ts");

    expect(source).not.toMatch(/from ["'](?:next|@\/|drizzle-orm|better-auth|@workos-inc)/);
  });

  it("keeps CLI dependent on SDK instead of server code", () => {
    const source = `${read("packages/cli/src/index.ts")}\n${read("packages/cli/src/bin.ts")}`;

    expect(source).not.toMatch(/from ["'](?:next|@\/|drizzle-orm|better-auth|@workos-inc)/);
    expect(source).toContain('from "@samrian/sdk"');
  });

  it("keeps MCP dependent on SDK and contracts only", () => {
    const source = ["config.ts", "results.ts", "server.ts", "tools.ts"]
      .map((file) => read(`packages/mcp/src/${file}`))
      .join("\n");

    expect(source).not.toMatch(
      /from ["'](?:next|@\/|drizzle-orm|better-auth|@better-auth|@workos-inc|bullmq|ioredis)/
    );
    expect(source).not.toMatch(/campaign_launch|inbox_reply/);
    expect(source).toContain('from "@samrian/sdk"');
  });
});
