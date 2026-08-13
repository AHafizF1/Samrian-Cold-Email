import { describe, expect, test, vi } from "vitest";

import {
  checkMailbox,
  classifyMailboxError,
  reconnectMailbox,
  removeMailbox,
} from "../../../src/server/modules/mailboxes";
import { FakeNotificationRepo } from "../../fakes/fake-repos";
import type { MailboxRecord } from "../../../src/server/ports";

function mailbox(overrides: Partial<MailboxRecord> = {}): MailboxRecord {
  return {
    id: "mailbox_1",
    orgId: "org_1",
    email: "sender@example.com",
    status: "active",
    sentToday: 0,
    dailySendLimit: 25,
    ...overrides,
  };
}

describe("mailbox module", () => {
  test("classifies reconnect failures as disconnected", () => {
    expect(
      classifyMailboxError({
        ok: false,
        error: "Invalid credentials",
        requiresReconnect: true,
      })
    ).toMatchObject({
      kind: "auth",
      status: "disconnected",
      requiresReconnect: true,
    });
  });

  test("classifies rate failures as limit reached", () => {
    expect(classifyMailboxError(new Error("429 Too Many Requests"))).toMatchObject({
      kind: "rate-limit",
      status: "limit_reached",
      providerLimitCode: "rate-limit",
    });
  });

  test("records healthy connection check and clears connection error", async () => {
    const updates: unknown[] = [];

    await expect(
      checkMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1" },
        {
          now: () => 1000,
          repos: {
            mailboxes: {
              getById: async () => mailbox({ lastConnectionError: "old error" }),
              recordConnectionSuccess: async (...args) => {
                updates.push(args);
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
            async close() {},
          }),
        }
      )
    ).resolves.toEqual({ status: "healthy", mailboxId: "mailbox_1" });

    expect(updates).toHaveLength(1);
  });

  test("disconnects and notifies once when check requires reconnect", async () => {
    const notifications = new FakeNotificationRepo();
    const mailboxUpdates: unknown[] = [];

    await checkMailbox(
      { mailboxId: "mailbox_1", orgId: "org_1" },
      {
        now: () => 1000,
        notifications,
        repos: {
          mailboxes: {
            getById: async () => mailbox({ status: "active" }),
            recordConnectionFailure: async (...args) => {
              mailboxUpdates.push(args);
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
            return { ok: false, error: "Invalid login", requiresReconnect: true };
          },
          async close() {},
        }),
      }
    );

    expect(mailboxUpdates).toHaveLength(1);
    expect(notifications.data).toHaveLength(1);
    expect(notifications.data[0]).toMatchObject({ type: "mailbox_disconnected" });
  });

  test("reconnect preserves unrelated fields and clears health state", async () => {
    const patch = vi.fn();

    await reconnectMailbox(
      {
        mailboxId: "mailbox_1",
        orgId: "org_1",
        encryptedRefreshToken: "refresh",
        encryptedAccessToken: "access",
        encryptedPassword: "password",
        tokenExpiresAt: new Date(1000),
        userEmail: "new@example.com",
      },
      {
        repos: {
          mailboxes: {
            reconnect: patch,
          },
        },
      }
    );

    expect(patch).toHaveBeenCalledWith("mailbox_1", "org_1", {
      encryptedRefreshToken: "refresh",
      encryptedAccessToken: "access",
      encryptedPassword: "password",
      tokenExpiresAt: new Date(1000),
      userEmail: "new@example.com",
      clearHealth: true,
    });
  });

  test("blocks mailbox delete when active campaign links exist unless forced", async () => {
    await expect(
      removeMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1", force: false },
        {
          now: () => 1000,
          repos: {
            mailboxes: {
              getById: async () => mailbox(),
              countActiveCampaignLinks: async () => 1,
            },
          },
        }
      )
    ).rejects.toThrow("Mailbox is linked to active campaigns");
  });

  test("forced mailbox delete archives mailbox and disables links", async () => {
    const archived: unknown[] = [];
    const disabled: unknown[] = [];

    await expect(
      removeMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1", force: true },
        {
          now: () => 1000,
          repos: {
            mailboxes: {
              getById: async () => mailbox(),
              countActiveCampaignLinks: async () => 2,
              archive: async (...args) => {
                archived.push(args);
              },
              disableCampaignLinks: async (...args) => {
                disabled.push(args);
                return 2;
              },
            },
          },
        }
      )
    ).resolves.toEqual({ status: "archived", disabledLinks: 2 });

    expect(disabled).toHaveLength(1);
    expect(archived).toHaveLength(1);
  });
});
