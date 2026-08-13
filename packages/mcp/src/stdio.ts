#!/usr/bin/env bun

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Samrian } from "@samrian/sdk";

import { getMcpConfig } from "./config";
import { createMcpServer } from "./server";

export async function main(env: Record<string, string | undefined> = process.env) {
  const config = getMcpConfig(env);
  const server = createMcpServer({
    mode: config.mode,
    createClient: (signal, correlationId) =>
      new Samrian({
        baseUrl: config.url,
        token: config.token,
        signal,
        correlationId,
        createId: () => correlationId,
      }),
  });
  const transport = new StdioServerTransport();
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await server.close();
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown startup failure";
  process.stderr.write(`Samrian MCP failed: ${message}\n`);
  process.exitCode = 1;
});
