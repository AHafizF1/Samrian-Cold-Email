import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";

import { GET } from "../../src/app/api/domains/check/route";

vi.mock("../../src/server/api/session-route", () => ({
  createSessionAction:
    (_operation: unknown, handler: (context: unknown, ...args: unknown[]) => Promise<unknown>) =>
    (...args: unknown[]) =>
      handler(
        {
          orgId: "org_1",
          userId: "user_1",
          role: "owner",
          tenant: (operation: (db: unknown) => unknown) => operation({}),
        },
        ...args
      ),
}));

vi.mock("../../src/server/auth", () => ({
  requireOrgAccess: vi.fn(async () => ({ orgId: "org_1", userId: "user_1", role: "owner" })),
}));

vi.mock("../../src/server/db/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("../../src/server/repos", () => ({
  createDomainPort: vi.fn(() => ({})),
}));

vi.mock("../../src/server/modules/domains", () => ({
  getDomainReadiness: vi.fn(async () => ({
    domain: "example.com",
    source: "dns",
    status: "pass",
    issues: [],
    warnings: [],
    cached: false,
  })),
}));

describe("domain check api", () => {
  test("requires domain", async () => {
    const response = await GET(new NextRequest("http://localhost/api/domains/check"));

    expect(response.status).toBe(400);
  });

  test("returns domain readiness", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/domains/check?domain=example.com")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "pass" });
  });
});
