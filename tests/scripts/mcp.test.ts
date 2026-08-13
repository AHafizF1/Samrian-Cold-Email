import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

describe("packaged MCP stdio", () => {
  it("initializes with protocol-only stdout", async () => {
    const transport = new StdioClientTransport({
      command: "bun",
      args: ["packages/mcp/src/stdio.ts"],
      env: {
        ...process.env,
        MCP_MODE: "read-only",
        SAMRIAN_TOKEN: "test-token",
        SAMRIAN_URL: "http://127.0.0.1:3000",
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "smoke", version: "1.0.0" });

    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.some((tool) => tool.name === "identity_get")).toBe(true);
    expect(tools.tools.some((tool) => tool.name === "contacts_import")).toBe(false);
    await client.close();
  });
});
