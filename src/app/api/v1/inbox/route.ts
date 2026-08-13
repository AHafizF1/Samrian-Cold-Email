import { pageQuerySchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { listInbox } from "@/server/modules/inbox";
import { createPostgresJobRepos } from "@/server/repos";

export async function GET(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "inbox.list",
    credentials,
    handler: async ({ principal }) => {
      const parsed = pageQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams)
      );
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid page", 400);
      const result = await listInbox(
        {
          orgId: principal.orgId,
          userId: principal.userId ?? principal.credentialId,
          limit: parsed.data.limit,
        },
        { repos: createPostgresJobRepos(getDb()) }
      );
      return {
        data: { items: result.threads.map(toInboxThread), unreadCount: result.unreadCount },
      };
    },
  })(request);
}

function toInboxThread(thread: Awaited<ReturnType<typeof listInbox>>["threads"][number]) {
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
    unread: thread.unread,
    ...(thread.displayText ? { displayText: thread.displayText } : {}),
    ...(thread.excerpt ? { excerpt: thread.excerpt } : {}),
  };
}
