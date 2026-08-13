import { describe, expect, it, vi } from "vitest";

import { createMcpCallGuard } from "../../../packages/mcp/src/limits";

describe("MCP call limits", () => {
  it("blocks repeated identical agent loops", () => {
    let now = 1_000;
    const guard = createMcpCallGuard({ mode: "read-only", now: () => now, identicalMax: 2 });

    expect(guard.enter("contacts_list", { limit: 25 })).toMatchObject({ allowed: true });
    expect(guard.enter("contacts_list", { limit: 25 })).toMatchObject({ allowed: true });
    expect(guard.enter("contacts_list", { limit: 25 })).toMatchObject({
      allowed: false,
      code: "AGENT_LOOP_DETECTED",
    });

    now += 60_000;
    expect(guard.enter("contacts_list", { limit: 25 })).toMatchObject({ allowed: true });
  });

  it("releases concurrent capacity after tool completion", () => {
    const guard = createMcpCallGuard({ mode: "read-only", concurrency: 1 });
    const first = guard.enter("contacts_list", { limit: 25 });
    expect(first.allowed).toBe(true);
    expect(guard.enter("campaigns_list", { limit: 25 })).toMatchObject({
      allowed: false,
      code: "CONCURRENCY_LIMITED",
    });
    if (first.allowed) first.release();
    expect(guard.enter("campaigns_list", { limit: 25 }).allowed).toBe(true);
  });
});
