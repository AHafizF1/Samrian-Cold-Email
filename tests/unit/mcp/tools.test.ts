import { operations } from "@samrian/contracts";
import { describe, expect, it } from "vitest";

import { getTools } from "../../../packages/mcp/src/tools";

const forbidden = ["campaigns.launch", "inbox.reply", "blocklist.add", "blocklist.remove"];

describe("MCP tool inventory", () => {
  it("exposes only read-risk tools in read-only mode", () => {
    const tools = getTools("read-only");
    expect(tools).not.toHaveLength(0);
    expect(tools.every((tool) => tool.operation.risk === "read")).toBe(true);
  });

  it("adds approved draft-safe writes in operator mode", () => {
    const tools = getTools("operator");
    expect(tools.some((tool) => tool.name === "contacts_import")).toBe(true);
    expect(tools.some((tool) => tool.name === "campaign_create")).toBe(true);
    expect(tools.some((tool) => tool.name === "mailbox_check")).toBe(true);
  });

  it("never registers high-impact or MCP-disabled operations", () => {
    const tools = getTools("operator");
    expect(tools.some((tool) => forbidden.includes(tool.operation.id))).toBe(false);
    expect(tools.every((tool) => tool.operation.mcp && tool.operation.risk !== "high")).toBe(true);
  });

  it("maps every entry to canonical operation metadata and complete annotations", () => {
    for (const tool of getTools("operator")) {
      expect(operations).toContain(tool.operation);
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]+$/);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.run).toBeTypeOf("function");
      expect(tool.annotations).toEqual(
        expect.objectContaining({
          readOnlyHint: tool.operation.risk === "read",
          destructiveHint: false,
          idempotentHint:
            tool.operation.risk === "read" || tool.operation.idempotency === "required",
        })
      );
    }
  });
});
