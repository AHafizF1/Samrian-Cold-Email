import { describe, expect, test, vi } from "vitest";

import { checkMailboxHealth } from "../../../src/server/jobs/mailbox";
import type { MailboxRecord } from "../../../src/server/ports";

describe("checkMailboxHealth", () => {
  test("checks connector health and closes connector", async () => {
    const close = vi.fn();
    const recorded: unknown[] = [];
    const mailbox: MailboxRecord = {
      id: "mailbox_1",
      orgId: "org_1",
      email: "sender@example.com",
      status: "active",
    };

    await expect(
      checkMailboxHealth(
        { mailboxId: "mailbox_1", orgId: "org_1" },
        {
          now: () => 1000,
          repos: {
            mailboxes: {
              getById: async () => mailbox,
              recordConnectionSuccess: async (...args) => {
                recorded.push(args);
              },
            },
          },
          connectorForMailbox: async () => ({
            async send() {
              throw new Error("unused");
            },
            async pollNewMessages() {
              return [];
            },
            async testConnection() {
              return { ok: true };
            },
            close,
          }),
        }
      )
    ).resolves.toEqual({ status: "healthy", mailboxId: "mailbox_1" });

    expect(recorded).toHaveLength(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
