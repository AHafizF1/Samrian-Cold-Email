import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SamrianError, type Samrian } from "../../../packages/sdk/src";
import { describe, expect, it, vi } from "vitest";

import { createMcpServer } from "../../../packages/mcp/src/server";

async function connected(mode: "read-only" | "operator", sdk: Partial<Samrian>) {
  const server = createMcpServer({
    mode,
    createClient: () => sdk as Samrian,
    createId: () => "req_test",
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe("MCP server", () => {
  it("initializes and filters tools by mode", async () => {
    const readOnly = await connected("read-only", {});
    const readTools = await readOnly.client.listTools();
    expect(readTools.tools.some((tool) => tool.name === "contacts_list")).toBe(true);
    expect(readTools.tools.some((tool) => tool.name === "contacts_import")).toBe(false);
    await readOnly.client.close();
    await readOnly.server.close();

    const operator = await connected("operator", {});
    const operatorTools = await operator.client.listTools();
    expect(operatorTools.tools.some((tool) => tool.name === "contacts_import")).toBe(true);
    expect(operatorTools.tools.some((tool) => tool.name === "campaign_launch")).toBe(false);
    await operator.client.close();
    await operator.server.close();
  });

  it("calls SDK and returns structured results", async () => {
    const { client, server } = await connected("read-only", {
      identity: { me: async () => ({ userId: "user_1", orgId: "org_1", scopes: [] }) },
    } as unknown as Partial<Samrian>);

    const result = await client.callTool({ name: "identity_get", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      data: { userId: "user_1", orgId: "org_1" },
      meta: { requestId: "req_test" },
      trust: "untrusted-external-content",
    });
    await client.close();
    await server.close();
  });

  it("returns safe tool errors", async () => {
    const { client, server } = await connected("read-only", {
      identity: {
        me: async () => {
          throw new SamrianError("Credential lacks identity:read", "MISSING_SCOPE", 403, "req_1");
        },
      },
    } as unknown as Partial<Samrian>);

    const result = await client.callTool({ name: "identity_get", arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: { code: "MISSING_SCOPE", requestId: "req_1" },
    });
    await client.close();
    await server.close();
  });

  it("bounds list input and generates idempotency for operator writes", async () => {
    const create = vi.fn(async () => ({ id: "group_1" }));
    const { client, server } = await connected("operator", {
      groups: { create },
    } as unknown as Partial<Samrian>);

    const invalid = await client.callTool({ name: "groups_list", arguments: { limit: 101 } });
    expect(invalid.isError).toBe(true);

    await client.callTool({
      name: "group_create",
      arguments: { name: "Prospects", contactIds: [] },
    });
    expect(create).toHaveBeenCalledWith(
      { name: "Prospects", rules: [], logic: "AND", isDynamic: false, contactIds: [] },
      { idempotencyKey: "req_test" }
    );
    await client.close();
    await server.close();
  });
});
