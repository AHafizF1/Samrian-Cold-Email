import { describe, expect, test } from "vitest";

import { classifyBounce, parseBounce } from "../../../src/server/modules/bounces";
import type { RawMessage } from "../../../src/server/jobs/types";

describe("bounce parsing", () => {
  test("classifies 5.x.x DSN as hard bounce", () => {
    expect(classifyBounce({ dsnCode: "5.1.1" })).toBe("hard");
  });

  test("classifies 4.x.x DSN as soft bounce", () => {
    expect(classifyBounce({ dsnCode: "4.2.2" })).toBe("soft");
  });

  test("defaults unknown bounce to soft", () => {
    expect(classifyBounce({ rawBody: "Delivery delayed without a status code" })).toBe("soft");
  });

  test("parses failed recipient from DSN headers and body", () => {
    const result = parseBounce(
      raw({
        headers: {
          "Content-Type": "multipart/report; report-type=delivery-status",
          "X-Failed-Recipients": "bad@example.com",
        },
        textBody: "Status: 5.1.1\nDiagnostic-Code: smtp; user unknown",
      })
    );

    expect(result).toMatchObject({
      bounceType: "hard",
      dsnCode: "5.1.1",
      email: "bad@example.com",
    });
  });
});

function raw(input: Partial<RawMessage>): RawMessage {
  return {
    messageId: "message_1",
    from: "mailer-daemon@example.com",
    to: ["sender@example.com"],
    subject: "Delivery Status Notification",
    textBody: "",
    headers: {},
    receivedAt: 1,
    ...input,
  };
}
