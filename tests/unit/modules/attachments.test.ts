import { describe, expect, test } from "vitest";

import {
  decideAttachment,
  downloadAttachment,
  limitAttachmentStream,
  sanitizeAttachmentName,
} from "../../../src/server/modules/attachments";
import type { AttachmentRef } from "../../../src/server/jobs/types";
import { FakeRepos } from "../../fakes/fake-repos";

describe("attachment module", () => {
  test("allows bounded Gmail and Microsoft documents", () => {
    expect(
      decideAttachment(input({ filename: "invoice.pdf", contentType: "application/pdf" }))
    ).toEqual({ status: "allowed" });
    expect(
      decideAttachment(
        input(
          {
            filename: "proposal.docx",
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
          "microsoft"
        )
      )
    ).toEqual({ status: "allowed" });
  });

  test.each(["page.html", "image.svg", "run.exe", "files.zip", "script.js", "disk.iso"])(
    "blocks active or unsupported file %s",
    (filename) => {
      expect(decideAttachment(input({ filename }))).toMatchObject({ status: "blocked" });
    }
  );

  test("blocks mismatched declared type", () => {
    expect(decideAttachment(input({ filename: "invoice.pdf", contentType: "text/html" }))).toEqual({
      status: "blocked",
      reason: "type-mismatch",
    });
  });

  test("opens oversized files in trusted provider UI", () => {
    expect(
      decideAttachment({
        ...input({ filename: "invoice.pdf", contentType: "application/pdf", size: 4_000_001 }),
        providerUrl: "https://mail.google.com/mail/u/0/#inbox/message_1",
      })
    ).toEqual({
      status: "open-provider",
      providerUrl: "https://mail.google.com/mail/u/0/#inbox/message_1",
    });
  });

  test("rejects generic IMAP and untrusted provider URLs", () => {
    expect(decideAttachment(input({}, "smtp"))).toEqual({
      status: "blocked",
      reason: "unsupported-provider",
    });
    expect(
      decideAttachment({
        ...input({ size: 4_000_001 }),
        providerUrl: "https://evil.example/steal",
      })
    ).toEqual({ status: "blocked", reason: "too-large" });
  });

  test("sanitizes path, control, and header characters from filenames", () => {
    expect(sanitizeAttachmentName('../../Invoice\r\n".pdf')).toBe("Invoice_.pdf");
  });

  test("aborts a stream that exceeds the declared limit", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    });

    await expect(new Response(limitAttachmentStream(stream, 3)).arrayBuffer()).rejects.toThrow(
      "Attachment exceeds download limit"
    );
  });

  test("loads provider bytes outside transaction and closes connector", async () => {
    const repos = attachmentRepos();
    const calls: string[] = [];
    let transactionOpen = false;

    const result = await downloadAttachment(
      { orgId: "org_1", threadId: "thread_1", attachmentId: "attachment_1" },
      {
        transaction: async (operation) => {
          transactionOpen = true;
          try {
            return await operation({ threads: repos.threads, mailboxes: repos.mailboxes });
          } finally {
            transactionOpen = false;
          }
        },
        connectorForMailbox: async () => ({
          async send() {
            throw new Error("unused");
          },
          async pollNewMessages() {
            return [];
          },
          async getAttachment() {
            expect(transactionOpen).toBe(false);
            calls.push("fetch");
            return {
              body: new Blob([new Uint8Array([1, 2, 3])]).stream(),
              size: 3,
            };
          },
          async close() {
            calls.push("close");
          },
        }),
      }
    );

    expect(result).toMatchObject({
      status: "allowed",
      filename: "invoice.pdf",
      size: 3,
    });
    expect(calls).toEqual(["fetch", "close"]);
  });

  test("hides wrong-org threads and never calls connector for blocked files", async () => {
    const repos = attachmentRepos();
    let connectorCalls = 0;
    const deps = {
      repos: { threads: repos.threads, mailboxes: repos.mailboxes },
      connectorForMailbox: async () => {
        connectorCalls += 1;
        throw new Error("must not connect");
      },
    };

    await expect(
      downloadAttachment(
        { orgId: "org_2", threadId: "thread_1", attachmentId: "attachment_1" },
        deps
      )
    ).rejects.toThrow("Thread not found");

    repos.threads.data[0].attachments![0].filename = "run.exe";
    await expect(
      downloadAttachment(
        { orgId: "org_1", threadId: "thread_1", attachmentId: "attachment_1" },
        deps
      )
    ).resolves.toEqual({ status: "blocked", reason: "unsupported-type" });
    expect(connectorCalls).toBe(0);
  });
});

function input(
  attachment: Partial<AttachmentRef> = {},
  provider: "google" | "microsoft" | "smtp" = "google"
) {
  return {
    provider,
    attachment: {
      id: "attachment_1",
      filename: "note.txt",
      size: 10,
      contentType: "text/plain",
      inline: false,
      ...attachment,
    },
  };
}

function attachmentRepos() {
  return new FakeRepos({
    mailboxes: [
      {
        id: "mailbox_1",
        orgId: "org_1",
        email: "sender@example.com",
        provider: "google",
      },
    ],
    threads: [
      {
        id: "thread_1",
        orgId: "org_1",
        mailboxId: "mailbox_1",
        providerMessageId: "provider_message_1",
        messageId: "message_1",
        direction: "received",
        subject: "Invoice",
        attachments: [
          {
            id: "attachment_1",
            filename: "invoice.pdf",
            size: 3,
            contentType: "application/pdf",
            inline: false,
          },
        ],
      },
    ],
  });
}
