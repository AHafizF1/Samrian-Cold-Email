import { describe, expect, test } from "vitest";

import {
  classifyInbound,
  normalizeInboundMessage,
  normalizeMessageId,
} from "../../../src/server/modules/inbound";
import type { RawMessage } from "../../../src/server/jobs/types";

describe("inbound classification", () => {
  test("classifies delivery status report as bounce, not reply", () => {
    expect(
      classifyInbound(
        raw({
          inReplyTo: "<sent_1@example.com>",
          from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
          subject: "Delivery Status Notification (Failure)",
          textBody: "Address not found. 550 5.1.1 NoSuchUser.",
          headers: { "Content-Type": "multipart/report; report-type=delivery-status" },
        })
      )
    ).toMatchObject({ kind: "bounce" });
  });

  test("classifies read receipt as auto-reply", () => {
    expect(
      classifyInbound(
        raw({
          subject: "Read: Product update",
          textBody: "This is a Return Receipt for the mail that you sent.",
          mimeType: "multipart/report",
          partMimeTypes: ["text/plain", "message/disposition-notification"],
          headers: { "Content-Type": "multipart/report; report-type=disposition-notification" },
        })
      )
    ).toMatchObject({ kind: "auto-reply" });
  });

  test("classifies out-of-office as auto-reply", () => {
    expect(
      classifyInbound(
        raw({
          subject: "Re: Hello",
          textBody: "I am out of office this week.",
          headers: { "Auto-Submitted": "auto-replied" },
        })
      )
    ).toMatchObject({ kind: "auto-reply" });
  });

  test("classifies unsubscribe phrases as unsubscribe", () => {
    expect(
      classifyInbound(
        raw({
          subject: "Re: Hello",
          textBody: "Please remove me from your list.",
        })
      )
    ).toMatchObject({ kind: "unsubscribe" });
  });

  test("normalizes bracketed message ids", () => {
    expect(normalizeMessageId(" <Sent_1@Example.com> ")).toBe("sent_1@example.com");
  });

  test("rejects oversized bodies without throwing", () => {
    expect(
      normalizeInboundMessage(
        raw({
          textBody: "x".repeat(256 * 1024 + 1),
        })
      )
    ).toEqual({ ok: false, reason: "body-too-large" });
  });

  test("rejects excessive headers and mime parts", () => {
    const headers = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`x-test-${index}`, "value"])
    );

    expect(normalizeInboundMessage(raw({ headers }))).toEqual({
      ok: false,
      reason: "too-many-headers",
    });
    expect(
      normalizeInboundMessage(
        raw({
          partMimeTypes: Array.from({ length: 101 }, () => "multipart/mixed"),
        })
      )
    ).toEqual({ ok: false, reason: "too-many-parts" });
  });

  test("removes nulls and bidi controls from stored envelope fields", () => {
    const result = normalizeInboundMessage(
      raw({
        from: "Ada\u202E <ada@example.com>\0",
        subject: "Invoice\u202Efdp.exe\0",
      })
    );

    expect(result).toMatchObject({
      ok: true,
      message: {
        from: "Ada <ada@example.com>",
        subject: "Invoicefdp.exe",
      },
    });
  });

  test("rejects excessive attachment metadata", () => {
    expect(
      normalizeInboundMessage(
        raw({
          attachments: Array.from({ length: 26 }, (_, index) => ({
            id: `attachment_${index}`,
            filename: `file_${index}.pdf`,
            size: 10,
            contentType: "application/pdf",
            inline: false,
          })),
        })
      )
    ).toEqual({ ok: false, reason: "invalid-attachments" });
  });

  test("rejects oversized provider identifiers and envelope addresses", () => {
    expect(
      normalizeInboundMessage(
        raw({
          providerMessageId: "x".repeat(999),
        })
      )
    ).toEqual({ ok: false, reason: "invalid-envelope" });

    expect(
      normalizeInboundMessage(
        raw({
          to: ["x".repeat(999)],
        })
      )
    ).toEqual({ ok: false, reason: "invalid-envelope" });
  });
});

function raw(input: Partial<RawMessage>): RawMessage {
  return {
    messageId: "reply_1",
    from: "ada@example.com",
    to: ["sender@example.com"],
    subject: "Re: Hello",
    textBody: "Human reply",
    headers: {},
    receivedAt: 1,
    ...input,
  };
}
