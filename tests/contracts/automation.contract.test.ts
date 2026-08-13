import {
  apiErrorSchema,
  apiResponseSchema,
  contactListQuerySchema,
  operations,
  scopePresets,
} from "../../packages/contracts/src";
import { describe, expect, it } from "vitest";

describe("automation contracts", () => {
  it("rejects unknown fields in public errors", () => {
    expect(() =>
      apiErrorSchema.parse({
        error: {
          code: "NOT_FOUND",
          message: "Campaign not found",
          requestId: "req_1",
          leaked: true,
        },
      })
    ).toThrow();
  });

  it("keeps response metadata bounded and explicit", () => {
    expect(
      apiResponseSchema.parse({ data: { id: "contact_1" }, meta: { requestId: "req_1" } })
    ).toEqual({ data: { id: "contact_1" }, meta: { requestId: "req_1" } });
  });

  it("classifies every public operation with scopes and risk", () => {
    expect(operations.length).toBeGreaterThan(0);
    expect(operations.every((operation) => operation.scopes.length > 0 && operation.risk)).toBe(
      true
    );
  });

  it("keeps MCP surface below sender capability", () => {
    expect(scopePresets.operator).not.toContain("campaigns:launch");
    expect(scopePresets.operator).not.toContain("inbox:reply");
    expect(scopePresets.sender).toEqual(
      expect.arrayContaining(["campaigns:launch", "inbox:reply"])
    );
  });

  it("bounds contact page size", () => {
    expect(contactListQuerySchema.parse({ limit: "100" }).limit).toBe(100);
    expect(() => contactListQuerySchema.parse({ limit: "101" })).toThrow();
  });

  it("advertises only implemented contact reads", () => {
    expect(operations.map(({ id }) => id)).toEqual([
      "identity.me",
      "contacts.list",
      "contacts.get",
      "contacts.import-preview",
      "contacts.import",
      "groups.list",
      "groups.get",
      "groups.preview",
      "campaigns.list",
      "campaigns.get",
      "campaigns.stats",
      "mailboxes.list",
      "mailboxes.check",
      "inbox.list",
      "inbox.get",
      "analytics.org",
      "analytics.campaign",
      "campaigns.validate",
      "campaigns.launch",
      "inbox.reply",
      "contacts.update",
      "groups.create",
      "groups.update",
      "campaigns.create",
      "campaigns.update",
      "blocklist.list",
      "blocklist.add",
      "blocklist.remove",
      "domains.get",
      "domains.check",
      "capabilities.get",
      "limits.get",
    ]);
    expect(operations.find(({ id }) => id === "campaigns.launch")?.mcp).toBe(false);
    expect(operations.find(({ id }) => id === "inbox.reply")?.idempotency).toBe("required");
  });
});
