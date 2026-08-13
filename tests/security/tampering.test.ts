import { describe, expect, test } from "vitest";
import {
  blocklistAddSchema,
  campaignDraftSchema,
  contactImportSchema,
  contactUpdateSchema,
  groupWriteSchema,
  replySchema,
} from "@samrian/contracts";

const writeSchemas = [
  contactImportSchema,
  contactUpdateSchema,
  groupWriteSchema,
  campaignDraftSchema,
  blocklistAddSchema,
  replySchema,
];

describe("payload tampering", () => {
  test("write contracts reject tenant and identity fields", () => {
    for (const schema of writeSchemas) {
      expect(schema.safeParse({ orgId: "org_b", userId: "user_b", role: "owner" }).success).toBe(
        false
      );
    }
  });

  test("contracts reject prototype and unknown-field injection", () => {
    expect(
      contactUpdateSchema.safeParse({
        email: "safe@example.com",
        orgId: "org_b",
        __proto__: { admin: true },
      }).success
    ).toBe(false);
  });
});
