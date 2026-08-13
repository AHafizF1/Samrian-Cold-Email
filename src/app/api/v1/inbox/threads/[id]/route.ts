import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { getThread } from "@/server/modules/inbox";
import { createPostgresJobRepos } from "@/server/repos";
import type { ThreadRecord } from "@/server/ports";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "inbox.get",
    credentials,
    handler: async ({ principal }) => {
      const { id } = await context.params;
      try {
        const result = await getThread(
          {
            orgId: principal.orgId,
            userId: principal.userId ?? principal.credentialId,
            threadId: id,
          },
          { repos: createPostgresJobRepos(getDb()) }
        );
        return {
          data: { thread: toThread(result.thread), messages: result.messages.map(toThread) },
        };
      } catch (error) {
        if (error instanceof Error && error.message === "Thread not found") {
          throw new ApiRouteError("NOT_FOUND", "Thread not found", 404);
        }
        throw error;
      }
    },
  })(request);
}

function toThread(thread: ThreadRecord & { displayText?: string; excerpt?: string }) {
  return {
    id: thread.id,
    ...(thread.campaignId ? { campaignId: thread.campaignId } : {}),
    ...(thread.contactId ? { contactId: thread.contactId } : {}),
    ...(thread.mailboxId ? { mailboxId: thread.mailboxId } : {}),
    ...(thread.direction ? { direction: thread.direction } : {}),
    ...(thread.classification ? { classification: thread.classification } : {}),
    ...(thread.from ? { from: thread.from } : {}),
    ...(thread.to ? { to: thread.to } : {}),
    subject: thread.subject,
    ...(thread.sentAt ? { sentAt: thread.sentAt } : {}),
    ...(thread.receivedAt ? { receivedAt: thread.receivedAt } : {}),
    ...(thread.displayText ? { displayText: thread.displayText } : {}),
    ...(thread.excerpt ? { excerpt: thread.excerpt } : {}),
  };
}
