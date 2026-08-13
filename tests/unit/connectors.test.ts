import { beforeEach, describe, expect, test, vi } from "vitest";

const { createTransport, sendMail } = vi.hoisted(() => {
  const send = vi.fn(async () => ({
    messageId: "message_1",
    accepted: ["to@example.com"],
    rejected: [],
  }));
  return {
    sendMail: send,
    createTransport: vi.fn(() => ({
      sendMail: send,
      verify: vi.fn(async () => true),
      close: vi.fn(),
    })),
  };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport,
  },
}));

vi.mock("../../lib/email-connectors/oauth", () => ({
  refreshAccessToken: vi.fn(async () => ({ accessToken: "access", expiresIn: 3600 })),
}));

import { GmailApiConnector } from "../../lib/email-connectors/gmail";
import { MicrosoftGraphConnector } from "../../lib/email-connectors/microsoft";
import { SmtpImapConnector } from "../../lib/email-connectors/smtp-imap";
import type { SendOptions } from "../../lib/email-connectors/types";

const message: SendOptions = {
  from: "sender@example.com",
  to: "to@example.com",
  subject: "Subject",
  html: "<p>Hello</p>",
  text: "Hello",
  headers: {
    "List-Unsubscribe": "<https://app.example.com/u>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  },
};

describe("mailbox connector headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("SMTP passes custom headers to Nodemailer", async () => {
    const connector = new SmtpImapConnector(
      {
        provider: "smtp",
        smtpHost: "smtp.example.com",
        smtpPort: 587,
        username: "sender@example.com",
        userEmail: "sender@example.com",
      },
      { type: "smtp-imap", password: "secret" },
      async () => ({ address: "8.8.8.8", servername: "smtp.example.com" })
    );

    await connector.send(message);

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "8.8.8.8",
        requireTLS: true,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 60_000,
        tls: expect.objectContaining({
          minVersion: "TLSv1.2",
          rejectUnauthorized: true,
          servername: "smtp.example.com",
        }),
      })
    );
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ headers: message.headers }));
  });

  test("Gmail raw RFC 2822 message includes custom headers", async () => {
    const fetch = vi.fn(async () => Response.json({ id: "gmail_1", threadId: "thread_1" }));
    vi.stubGlobal("fetch", fetch);

    const connector = new GmailApiConnector(
      { provider: "google", userEmail: "sender@example.com" },
      { type: "oauth2", refreshToken: "refresh" }
    );

    await connector.send(message);
    const body = JSON.parse(String(callInit(fetch, 0).body)) as { raw: string };
    const raw = decodeBase64Url(body.raw);

    expect(raw).toContain("List-Unsubscribe: <https://app.example.com/u>");
    expect(raw).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  });

  test("Gmail Nodemailer fallback passes custom headers", async () => {
    const fetch = vi.fn(async () => new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetch);

    const connector = new GmailApiConnector(
      { provider: "google", userEmail: "sender@example.com" },
      { type: "oauth2", refreshToken: "refresh" }
    );

    await connector.send(message);

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ headers: message.headers }));
  });

  test("Microsoft Graph uses MIME when standard unsubscribe headers are present", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetch);

    const connector = new MicrosoftGraphConnector(
      { provider: "microsoft", userEmail: "sender@example.com" },
      { type: "oauth2", refreshToken: "refresh" }
    );

    await connector.send(message);

    expect(callInit(fetch, 0).headers).toMatchObject({ "Content-Type": "text/plain" });
    expect(decodeBase64(String(callInit(fetch, 0).body))).toContain(
      "List-Unsubscribe-Post: List-Unsubscribe=One-Click"
    );
  });

  test("Microsoft Graph keeps JSON send path when headers are disabled", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetch);

    const connector = new MicrosoftGraphConnector(
      { provider: "microsoft", userEmail: "sender@example.com" },
      { type: "oauth2", refreshToken: "refresh" }
    );

    await connector.send({ ...message, headers: undefined });

    expect(callInit(fetch, 0).headers).toMatchObject({ "Content-Type": "application/json" });
  });

  test.each([
    [
      "Gmail",
      () =>
        new GmailApiConnector(
          { provider: "google", userEmail: "sender@example.com" },
          { type: "oauth2", refreshToken: "refresh" }
        ),
    ],
    [
      "Microsoft",
      () =>
        new MicrosoftGraphConnector(
          { provider: "microsoft", userEmail: "sender@example.com" },
          { type: "oauth2", refreshToken: "refresh" }
        ),
    ],
  ])("%s rejects CRLF in MIME headers", async (_name, createConnector) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 202 }))
    );
    await expect(
      createConnector().send({ ...message, subject: "Safe\r\nBcc: attacker@example.com" })
    ).rejects.toThrow("Invalid email header");
  });

  test("Gmail exposes attachment metadata and fetches attachment bytes", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ messages: [{ id: "message_1" }] }))
      .mockResolvedValueOnce(
        Response.json({
          id: "message_1",
          threadId: "thread_1",
          payload: {
            headers: [
              { name: "Message-ID", value: "<message_1@example.com>" },
              { name: "From", value: "ada@example.com" },
            ],
            parts: [
              {
                partId: "1",
                filename: "invoice.pdf",
                mimeType: "application/pdf",
                headers: [{ name: "Content-Disposition", value: "attachment" }],
                body: { attachmentId: "attachment_1", size: 3 },
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(Response.json({ data: "AQID", size: 3 }));
    vi.stubGlobal("fetch", fetch);
    const connector = new GmailApiConnector(
      { provider: "google", userEmail: "sender@example.com" },
      { type: "oauth2", refreshToken: "refresh" }
    );

    const messages = await connector.pollNewMessages();
    expect(messages[0]?.attachments).toEqual([
      {
        id: "attachment_1",
        filename: "invoice.pdf",
        size: 3,
        contentType: "application/pdf",
        inline: false,
      },
    ]);

    const download = await connector.getAttachment("message_1", "attachment_1");
    expect(new Uint8Array(await new Response(download?.body).arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3])
    );
  });

  test("Microsoft exposes attachment metadata and streams attachment bytes", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          value: [
            {
              id: "message_1",
              internetMessageId: "<message_1@example.com>",
              from: { emailAddress: { address: "ada@example.com" } },
              attachments: [
                {
                  id: "attachment_1",
                  name: "invoice.pdf",
                  contentType: "application/pdf",
                  size: 3,
                  isInline: false,
                },
              ],
              webLink: "https://outlook.office.com/mail/inbox/id/message_1",
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Length": "3" },
        })
      );
    vi.stubGlobal("fetch", fetch);
    const connector = new MicrosoftGraphConnector(
      { provider: "microsoft", userEmail: "sender@example.com" },
      { type: "oauth2", refreshToken: "refresh" }
    );

    const messages = await connector.pollNewMessages();
    expect(messages[0]).toMatchObject({
      attachments: [
        {
          id: "attachment_1",
          filename: "invoice.pdf",
          size: 3,
          contentType: "application/pdf",
          inline: false,
        },
      ],
      providerUrl: "https://outlook.office.com/mail/inbox/id/message_1",
    });

    const download = await connector.getAttachment("message_1", "attachment_1");
    expect(new Uint8Array(await new Response(download?.body).arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3])
    );
  });

  test("Gmail bounds nested MIME traversal", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ messages: [{ id: "message_1" }] }))
      .mockResolvedValueOnce(
        Response.json({
          id: "message_1",
          threadId: "thread_1",
          payload: {
            headers: [
              { name: "Message-ID", value: "<message_1@example.com>" },
              { name: "From", value: "ada@example.com" },
            ],
            ...nestedPart(12),
          },
        })
      );
    vi.stubGlobal("fetch", fetch);
    const connector = new GmailApiConnector(
      { provider: "google", userEmail: "sender@example.com" },
      { type: "oauth2", refreshToken: "refresh" }
    );

    const messages = await connector.pollNewMessages();

    expect(messages[0]?.partMimeTypes?.length).toBeLessThanOrEqual(11);
  });
});

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

function decodeBase64(value: string) {
  return Buffer.from(value, "base64").toString("utf8");
}

function callInit(fetch: ReturnType<typeof vi.fn>, index: number) {
  return fetch.mock.calls[index]?.[1] as RequestInit;
}

function nestedPart(depth: number): object {
  return depth === 0
    ? { mimeType: "text/plain", body: { data: "SGVsbG8=" } }
    : { mimeType: "multipart/mixed", parts: [nestedPart(depth - 1)] };
}
