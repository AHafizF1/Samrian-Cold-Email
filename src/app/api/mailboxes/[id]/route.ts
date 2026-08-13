import { NextRequest, NextResponse } from "next/server";

import { createSessionAction } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { removeMailbox } from "@/server/modules/mailboxes";
import { PostgresAuditRepo, PostgresMailboxRepo } from "@/server/repos";
import {
  getMailboxRevocationToken,
  revokeGoogleToken,
} from "../../../../../lib/email-connectors/revoke";

export const DELETE = createSessionAction(
  sessionOperations.mailboxArchive,
  async (
    { orgId, userId, tenant },
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await context.params;
    try {
      const result = await removeMailbox(
        {
          mailboxId: id,
          orgId,
          userId,
          force: request.nextUrl.searchParams.get("force") === "true",
        },
        {
          now: Date.now,
          revokeToken: async (mailboxId, orgId) => {
            const token = await tenant((db) =>
              getMailboxRevocationToken(new PostgresMailboxRepo(db), mailboxId, orgId)
            );
            if (token) await revokeGoogleToken(token);
          },
          transaction: (operation) =>
            tenant((db) =>
              operation({
                mailboxes: new PostgresMailboxRepo(db),
                audit: new PostgresAuditRepo(db),
              })
            ),
        }
      );

      if (result.status === "missing") {
        return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
      }
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to delete mailbox" },
        { status: 409 }
      );
    }
  }
);
