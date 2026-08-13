import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

describe("auth client facade", () => {
  test("dashboard code does not import Better Auth client directly", async () => {
    const layout = await readFile("src/app/dashboard/layout.tsx", "utf8");
    const sidebar = await readFile("src/components/app-sidebar.tsx", "utf8");

    expect(layout).not.toContain("@/lib/auth-client");
    expect(sidebar).not.toContain("@/lib/auth-client");
    expect(layout).toContain("@/lib/auth");
    expect(sidebar).toContain("@/lib/auth");
  });

  test("client facade exposes provider-neutral auth hooks and actions", async () => {
    const source = await readFile("src/lib/auth.ts", "utf8");

    expect(source).toContain("useAuthSession");
    expect(source).toContain("signInWithEmail");
    expect(source).toContain("signUpWithEmail");
    expect(source).toContain("signInWithGoogle");
    expect(source).toContain("signOut");
  });

  test("keeps user Google auth separate from Gmail mailbox OAuth", async () => {
    const config = await readFile("src/server/auth/config.ts", "utf8");
    const mailbox = await readFile("src/app/api/auth/google/route.ts", "utf8");

    expect(config).toContain("GOOGLE_AUTH_CLIENT_ID");
    expect(config).toContain("GOOGLE_AUTH_CLIENT_SECRET");
    expect(config).not.toContain("GOOGLE_CLIENT_ID");
    expect(mailbox).toContain("GOOGLE_CLIENT_ID");
    expect(mailbox).not.toContain("GOOGLE_AUTH_CLIENT_ID");
  });
});
