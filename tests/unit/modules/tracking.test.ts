import { describe, expect, test } from "vitest";

import {
  applyTracking,
  clickEvent,
  openEvent,
  validateTrackedUrl,
} from "../../../src/server/modules/tracking";

describe("tracking module", () => {
  test.each(["javascript:alert(1)", "data:text/html,pwn", "file:///etc/passwd"])(
    "rejects unsafe redirect URL %s",
    (value) => expect(() => validateTrackedUrl(value)).toThrow("Tracked URL must use http or https")
  );

  test("accepts HTTPS redirect URLs", () => {
    expect(validateTrackedUrl("https://example.com/path").href).toBe("https://example.com/path");
  });

  test("builds unique click and open events", () => {
    expect(clickEvent({ orgId: "org_1", token: "token_1", occurredAt: 1000 })).toMatchObject({
      type: "click",
      dedupeKey: "click:token_1:unique",
      metadata: { unique: true },
    });
    expect(openEvent({ orgId: "org_1", token: "token_1", occurredAt: 1000 })).toMatchObject({
      type: "open",
      dedupeKey: "open:token_1:unique",
      metadata: { unique: true },
    });
  });

  test("rewrites safe links and appends pixel only when enabled", async () => {
    const links: unknown[] = [];
    const result = await applyTracking({
      rendered: {
        subject: "Hi",
        htmlBody: '<a href="https://example.com">Read</a><a href="javascript:bad">Bad</a>',
        textBody: "Read",
      },
      appUrl: "https://app.example.com",
      clickTrackingEnabled: true,
      openTrackingEnabled: true,
      context: { orgId: "org_1", campaignId: "campaign_1" },
      events: {
        record: async () => ({ accepted: true }),
        createTrackedLink: async (input) => {
          links.push(input);
          return input;
        },
      },
    });

    expect(result.htmlBody).toContain("https://app.example.com/api/track/click/");
    expect(result.htmlBody).toContain("https://app.example.com/api/track/open/");
    expect(result.htmlBody).toContain('href="javascript:bad"');
    expect(links).toHaveLength(2);
  });
});
