import { SamrianError } from "../../../packages/sdk/src";
import { describe, expect, it } from "vitest";

import { failure, success } from "../../../packages/mcp/src/results";

describe("MCP results", () => {
  it("returns concise text and structured untrusted data", () => {
    expect(
      success({ items: [{ email: "prompt@example.com" }] }, "Found 1 contact.", "req_1")
    ).toEqual({
      content: [{ type: "text", text: "Found 1 contact." }],
      structuredContent: {
        data: { items: [{ email: "prompt@example.com" }] },
        meta: { requestId: "req_1" },
        trust: "untrusted-external-content",
      },
    });
  });

  it("maps SDK errors without stack or credentials", () => {
    const result = failure(
      new SamrianError("Credential lacks contacts:write", "MISSING_SCOPE", 403, "req_1")
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: {
        code: "MISSING_SCOPE",
        message: "Credential lacks contacts:write",
        requestId: "req_1",
      },
    });
    expect(JSON.stringify(result)).not.toContain("stack");
  });

  it("redacts unexpected failures", () => {
    expect(failure(new Error("secret token value")).structuredContent).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Unexpected MCP failure" },
    });
  });
});
