import { NextResponse } from "next/server";

import { createSessionAction } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { getDb } from "@/server/db/db";
import { sendReply } from "@/server/modules/inbox";
import { createPostgresJobRepos, createTenantConnectorFactory } from "@/server/repos";

export const POST = createSessionAction(
  sessionOperations.inboxReply,
  async (
    { orgId, userId, tenant },
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await context.params;
    const body = await request.json();

    try {
      const result = await sendReply(
        {
          orgId,
          userId,
          threadId: id,
          body: String(body.body ?? ""),
          subject: typeof body.subject === "string" ? body.subject : undefined,
          clientRequestId:
            typeof body.clientRequestId === "string" && body.clientRequestId.trim()
              ? body.clientRequestId.trim()
              : crypto.randomUUID(),
        },
        {
          transaction: (operation) =>
            tenant((db) => {
              const repos = createPostgresJobRepos(db);
              return operation({ mailboxes: repos.mailboxes, threads: repos.threads });
            }),
          connectorForMailbox: createTenantConnectorFactory(getDb(), {
            actorType: "request",
            userId,
          }),
          now: Date.now,
        }
      );

      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Reply failed" },
        { status: statusFor(error) }
      );
    }
  },
  { operationId: "inbox.reply", bodyLimitBytes: 128 * 1024 }
);

function statusFor(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("required")) return 400;
  if (message.includes("not found")) return 404;
  if (message.includes("not available")) return 409;
  return 500;
}
