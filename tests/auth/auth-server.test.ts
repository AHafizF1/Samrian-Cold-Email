import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

describe("auth route provider isolation", () => {
  test("loads Better Auth lazily after provider selection", async () => {
    const source = await readFile("src/lib/auth-server.ts", "utf8");
    const barrel = await readFile("src/server/auth/index.ts", "utf8");

    expect(source).not.toMatch(/^import .*server\/auth/m);
    expect(source).toContain('AUTH_PROVIDER === "workos"');
    expect(source).toContain('import("@/server/auth/auth")');
    expect(barrel).not.toContain('export * from "./auth"');
  });
});
