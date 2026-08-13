import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GET } from "../../src/app/api/inbox/threads/[id]/attachments/[attachmentId]/route";
import { downloadAttachment } from "../../src/server/modules/attachments";

vi.mock("../../src/server/api/session-route", () => ({
  createSessionAction:
    (_operation: unknown, handler: (context: unknown, ...args: unknown[]) => Promise<unknown>) =>
    (...args: unknown[]) =>
      handler(
        {
          orgId: "org_1",
          userId: "user_1",
          tenant: (operation: (db: unknown) => unknown) => operation({}),
        },
        ...args
      ),
}));

vi.mock("../../src/server/db/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("../../src/server/repos", () => ({
  createPostgresJobRepos: vi.fn(() => ({ threads: {}, mailboxes: {} })),
  createTenantConnectorFactory: vi.fn(() => vi.fn()),
}));

vi.mock("../../src/server/modules/attachments", async (original) => {
  const actual = await original<typeof import("../../src/server/modules/attachments")>();
  return { ...actual, downloadAttachment: vi.fn() };
});

describe("attachment download api", () => {
  beforeEach(() => vi.clearAllMocks());

  test("forces allowed attachment download with hardened headers", async () => {
    vi.mocked(downloadAttachment).mockResolvedValue({
      status: "allowed",
      body: new Blob([new Uint8Array([1, 2, 3])]).stream(),
      filename: 'Invoice_".pdf',
      size: 3,
    });

    const response = await request();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("content-disposition")).not.toContain("\r");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  test("returns bounded blocked and provider handoff responses", async () => {
    vi.mocked(downloadAttachment).mockResolvedValueOnce({
      status: "blocked",
      reason: "unsupported-type",
    });
    expect((await request()).status).toBe(415);

    vi.mocked(downloadAttachment).mockResolvedValueOnce({
      status: "open-provider",
      providerUrl: "https://mail.google.com/mail/u/0/#inbox/thread_1",
    });
    const response = await request();
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      status: "open-provider",
      providerUrl: "https://mail.google.com/mail/u/0/#inbox/thread_1",
    });
  });
});

function request() {
  return GET(
    new NextRequest("http://localhost/api/inbox/threads/thread_1/attachments/attachment_1"),
    {
      params: Promise.resolve({ id: "thread_1", attachmentId: "attachment_1" }),
    }
  );
}
