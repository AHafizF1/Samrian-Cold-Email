import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";

import { createAuthOptions } from "../../src/server/auth/better";

describe("postgres auth config", () => {
  test("uses Better Auth with Drizzle adapter and organization roles", () => {
    const options = createAuthOptions({ database: "db-adapter" });
    const organization = options.plugins?.find((plugin) => plugin.id === "organization");

    expect(options.database).toBe("db-adapter");
    expect(organization).toBeDefined();
    expect(organization?.schema).toHaveProperty("organizationRole");
  });

  test("client auth uses app-owned Better Auth client only", async () => {
    const source = await readFile("src/lib/auth-client.ts", "utf8");

    expect(source).toContain("createAuthClient");
    expect(source).toContain("organizationClient");
    expect(source).toContain("dynamicAccessControl");
  });
});
