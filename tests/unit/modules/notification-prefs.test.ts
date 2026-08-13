import { describe, expect, test } from "vitest";

import {
  getDefaultNotificationPrefs,
  normalizeNotificationPrefs,
  shouldForwardReply,
} from "../../../src/server/modules/notification-prefs";

describe("notification prefs module", () => {
  test("defaults to in-app reply notifications without forwarding or browser push", () => {
    expect(getDefaultNotificationPrefs("org_1", "user_1")).toMatchObject({
      orgId: "org_1",
      userId: "user_1",
      replyInAppEnabled: true,
      replyForwardEnabled: false,
      replyForwardEmails: [],
      browserPushEnabled: false,
    });
  });

  test("normalizes forwarding emails and ignores invalid addresses", () => {
    expect(
      normalizeNotificationPrefs({
        orgId: "org_1",
        userId: "user_1",
        replyForwardEnabled: true,
        replyForwardEmails: [" Ada@Example.com ", "bad", "ada@example.com", "bob@example.com"],
      })
    ).toMatchObject({
      replyForwardEnabled: true,
      replyForwardEmails: ["ada@example.com", "bob@example.com"],
    });
  });

  test("requires enabled forwarding and at least one valid email", () => {
    expect(
      shouldForwardReply({
        ...getDefaultNotificationPrefs("org_1", "user_1"),
        replyForwardEnabled: true,
        replyForwardEmails: ["owner@example.com"],
      })
    ).toBe(true);
    expect(shouldForwardReply(getDefaultNotificationPrefs("org_1", "user_1"))).toBe(false);
  });
});
