import { describe, expect, test } from "vitest";

import {
  buildEmailDisplay,
  getSafeEmailLinks,
  parseEmailSender,
} from "../../../src/server/modules/email-display";

describe("email display module", () => {
  test("uses text body and strips quoted reply blocks", () => {
    expect(
      buildEmailDisplay({
        textBody: "Yes, let's talk.\n\nOn Tue, Sam wrote:\n> Original pitch",
        htmlBody: "<p>ignored</p>",
      })
    ).toEqual({
      excerpt: "Yes, let's talk.",
      text: "Yes, let's talk.",
    });
  });

  test("does not expose raw html when text body is missing", () => {
    expect(
      buildEmailDisplay({
        htmlBody: "<script>alert(1)</script><p>Hello&nbsp;<strong>Ada</strong></p>",
      })
    ).toEqual({
      excerpt: "Hello Ada",
      text: "Hello Ada",
    });
  });

  test("renders hostile active content as inert text", () => {
    const display = buildEmailDisplay({
      htmlBody:
        '<svg><script>alert(1)</script></svg><form action="https://evil.test">' +
        '<input value="password"></form><iframe srcdoc="<script>top.alert(1)</script>"></iframe>' +
        "<p>Hello&#x20;Ada</p>",
    });

    expect(display.text).not.toContain("<");
    expect(display.text).not.toContain("alert");
    expect(display.text).toContain("Hello Ada");
  });

  test("removes bidi and null controls and bounds display text", () => {
    const display = buildEmailDisplay({
      textBody: `Invoice\u202Efdp.exe\0 ${"x".repeat(300_000)}`,
    });

    expect(display.text).not.toContain("\u202E");
    expect(display.text).not.toContain("\0");
    expect(display.text.length).toBeLessThanOrEqual(256 * 1024);
  });

  test("separates sender display name from actual address", () => {
    expect(parseEmailSender("PayPal Support <attacker@paypa\u043b.test>")).toEqual({
      address: "attacker@xn--paypa-4xe.test",
      name: "PayPal Support",
      suspicious: true,
    });
  });

  test("exposes only canonical http links with visible hostnames", () => {
    expect(
      getSafeEmailLinks(
        "Open https://Example.com/path and javascript:alert(1) and https://example.com/path"
      )
    ).toEqual([
      {
        hostname: "example.com",
        url: "https://example.com/path",
      },
    ]);
  });
});
