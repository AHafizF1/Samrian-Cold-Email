import { NextRequest, NextResponse } from "next/server";

import { createSessionAction } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { getDb } from "@/server/db/db";
import { checkMailboxHealth } from "@/server/jobs/mailbox";
import {
  createTenantConnectorFactory,
  PostgresMailboxRepo,
  PostgresNotificationRepo,
} from "@/server/repos";

export const POST = createSessionAction(
  sessionOperations.mailboxCheck,
  async (
    { orgId, userId, tenant },
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await context.params;
    const result = await checkMailboxHealth(
      { mailboxId: id, orgId },
      {
        transaction: (operation) =>
          tenant((db) => operation({ mailboxes: new PostgresMailboxRepo(db) })),
        connectorForMailbox: createTenantConnectorFactory(getDb(), {
          actorType: "request",
          userId,
        }),
        notifications: {
          create: (input) => tenant((db) => new PostgresNotificationRepo(db).create(input)),
          getById: (id, orgId) =>
            tenant((db) => new PostgresNotificationRepo(db).getById(id, orgId)),
          listLatest: (input) => tenant((db) => new PostgresNotificationRepo(db).listLatest(input)),
          countUnread: (input) =>
            tenant((db) => new PostgresNotificationRepo(db).countUnread(input)),
          markRead: (id, orgId, at) =>
            tenant((db) => new PostgresNotificationRepo(db).markRead(id, orgId, at)),
          markAllRead: (input, at) =>
            tenant((db) => new PostgresNotificationRepo(db).markAllRead(input, at)),
        },
        now: Date.now,
      }
    );

    if (result.status === "missing") {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  },
  { operationId: "mailboxes.check" }
);
