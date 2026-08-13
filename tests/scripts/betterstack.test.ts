import { describe, expect, test, vi } from "vitest";

import { runBetterStackSetup } from "../../scripts/betterstack";

describe("Better Stack setup script", () => {
  test("dry-run validates and prints plan without network calls", async () => {
    const fetch = vi.fn();
    const write = vi.fn();

    const result = await runBetterStackSetup({
      args: [],
      env: { BETTER_STACK_UPTIME_TOKEN: "token-secret", BETTER_STACK_STATUS_PAGE_ID: "page_1" },
      fetch,
      write,
    });

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(write.mock.calls.join("\n")).toContain("Dry run");
    expect(write.mock.calls.join("\n")).not.toContain("token-secret");
  });

  test("apply requires Better Stack uptime token", async () => {
    const result = await runBetterStackSetup({
      args: ["--apply"],
      env: {},
      fetch: vi.fn(),
      write: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain("missing env: BETTER_STACK_UPTIME_TOKEN");
  });

  test("apply sends monitor payloads with bearer auth", async () => {
    const fetch = vi.fn(async () => Response.json({ data: { id: "monitor_1" } }));
    const write = vi.fn();

    const result = await runBetterStackSetup({
      args: ["--apply"],
      env: { BETTER_STACK_UPTIME_TOKEN: "token-secret" },
      fetch,
      write,
      baseUrl: "https://app.example.com",
    });

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://uptime.betterstack.com/api/v2/monitors",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-secret" }),
      })
    );
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.data).toMatchObject({
      type: "monitor",
      attributes: expect.objectContaining({
        url: expect.stringContaining("https://app.example.com"),
      }),
    });
    expect(write.mock.calls.join("\n")).not.toContain("token-secret");
  });

  test("status page sync requires status page id", async () => {
    const result = await runBetterStackSetup({
      args: ["--apply", "--status-page"],
      env: { BETTER_STACK_UPTIME_TOKEN: "token-secret" },
      fetch: vi.fn(),
      write: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain("missing env: BETTER_STACK_STATUS_PAGE_ID");
  });
});
