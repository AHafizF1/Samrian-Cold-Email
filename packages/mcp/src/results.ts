import { SamrianError } from "@samrian/sdk";

export class McpToolError extends Error {
  constructor(
    readonly code: "AGENT_LOOP_DETECTED" | "CONCURRENCY_LIMITED",
    message: string
  ) {
    super(message);
  }
}

export function success(data: unknown, summary: string, requestId?: string, nextCursor?: string) {
  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent: {
      data,
      meta: { ...(requestId ? { requestId } : {}), ...(nextCursor ? { nextCursor } : {}) },
      trust: "untrusted-external-content",
    },
  };
}

export function failure(error: unknown) {
  const safe =
    error instanceof SamrianError
      ? {
          code: error.code,
          message: error.message,
          ...(error.requestId ? { requestId: error.requestId } : {}),
        }
      : error instanceof McpToolError
        ? { code: error.code, message: error.message }
        : { code: "INTERNAL_ERROR", message: "Unexpected MCP failure" };
  const request = "requestId" in safe ? ` Request ${safe.requestId}.` : "";
  return {
    isError: true,
    content: [{ type: "text" as const, text: `${safe.code}: ${safe.message}.${request}` }],
    structuredContent: { error: safe },
  };
}
