import { describe, expect, test } from "vitest";

import { matchContactGroup, validateGroupRules } from "../../../src/server/modules/groups";
import type { ContactRecord } from "../../../src/server/ports";

const contacts: ContactRecord[] = [
  {
    id: "contact_1",
    orgId: "org_1",
    email: "ada@example.com",
    domain: "example.com",
    timezone: "UTC",
    customVars: { role: "cto", score: 10 },
    verificationStatus: "valid",
  },
  {
    id: "contact_2",
    orgId: "org_1",
    email: "grace@test.com",
    domain: "test.com",
    timezone: "Africa/Nairobi",
    customVars: { role: "engineer", score: 5 },
    bounceStatus: "hard",
  },
];

describe("group matching module", () => {
  test("validates unknown field and operator", () => {
    expect(validateGroupRules([{ field: "unknown", operator: "equals", value: "x" }])).toEqual([
      "Unknown group rule field: unknown",
    ]);
    expect(validateGroupRules([{ field: "email", operator: "near", value: "x" }])).toEqual([
      "Unknown group rule operator: near",
    ]);
  });

  test("matches dynamic AND and OR groups", () => {
    expect(
      matchContactGroup(contacts, {
        logic: "AND",
        rules: [
          { field: "domain", operator: "equals", value: "example.com" },
          { field: "customVars.role", operator: "contains", value: "ct" },
        ],
      }).map((contact) => contact.id)
    ).toEqual(["contact_1"]);

    expect(
      matchContactGroup(contacts, {
        logic: "OR",
        rules: [
          { field: "timezone", operator: "equals", value: "Africa/Nairobi" },
          { field: "verificationStatus", operator: "equals", value: "valid" },
        ],
      }).map((contact) => contact.id)
    ).toEqual(["contact_1", "contact_2"]);
  });

  test("supports operator set and sample limits", () => {
    expect(
      matchContactGroup(
        contacts,
        {
          logic: "AND",
          rules: [
            { field: "email", operator: "endsWith", value: "@example.com" },
            { field: "customVars.score", operator: "gte", value: 10 },
            { field: "bounceStatus", operator: "notExists" },
          ],
        },
        { limit: 1 }
      ).map((contact) => contact.id)
    ).toEqual(["contact_1"]);
  });
});
