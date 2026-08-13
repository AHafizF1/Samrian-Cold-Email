import { describe, expect, test } from "vitest";
import {
  blocklistAddSchema,
  campaignDraftSchema,
  contactUpdateSchema,
  groupWriteSchema,
} from "@samrian/contracts";
import { protectedFields } from "./fixtures";

describe("mass assignment", () => {
  test.each([
    ["contact", contactUpdateSchema, { email: "safe@example.com" }],
    ["group", groupWriteSchema, { name: "Safe", type: "static", contactIds: [] }],
    ["campaign", campaignDraftSchema, { name: "Safe" }],
    ["blocklist", blocklistAddSchema, { email: "blocked@example.com", reason: "manual" }],
  ])("%s write rejects protected fields", (_name, schema, valid) => {
    const payload = {
      ...valid,
      status: "active",
      ...Object.fromEntries(protectedFields.map((field) => [field, "attacker-controlled"])),
    };
    expect(schema.safeParse(payload).success).toBe(false);
  });
});
