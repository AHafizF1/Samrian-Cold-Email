import { afterEach, describe, expect, test } from "vitest";

import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../../../src/server/modules/unsubscribe";

const original = process.env.UNSUBSCRIBE_SECRET;

afterEach(() => {
  if (original === undefined) delete process.env.UNSUBSCRIBE_SECRET;
  else process.env.UNSUBSCRIBE_SECRET = original;
});

describe("unsubscribe tokens", () => {
  test("uses dedicated secret so rotation invalidates old tokens", () => {
    process.env.UNSUBSCRIBE_SECRET = "a".repeat(32);
    const token = createUnsubscribeToken({
      orgId: "org_1",
      contactId: "contact_1",
      campaignId: "campaign_1",
    });

    process.env.UNSUBSCRIBE_SECRET = "b".repeat(32);
    expect(() =>
      verifyUnsubscribeToken(token, {
        contactId: "contact_1",
        campaignId: "campaign_1",
      })
    ).toThrow("Invalid unsubscribe token");
  });
});
