import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { checkMailboxHealth } from "@/server/jobs/mailbox";
import {
  createTenantConnectorFactory,
  PostgresMailboxRepo,
  PostgresNotificationRepo,
} from "@/server/repos";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "mailboxes.check",
    credentials,
    transaction: "explicit",
    handler: async ({ principal, tenant }) => {
      const { id } = await context.params;
      const db = getDb();
      const result = await checkMailboxHealth(
        { mailboxId: id, orgId: principal.orgId },
        {
          transaction: (operation) =>
            tenant((db) => operation({ mailboxes: new PostgresMailboxRepo(db) })),
          connectorForMailbox: createTenantConnectorFactory(db, {
            actorType: "request",
            userId: principal.userId,
          }),
          notifications: {
            create: (input) => tenant((db) => new PostgresNotificationRepo(db).create(input)),
            getById: (id, orgId) =>
              tenant((db) => new PostgresNotificationRepo(db).getById(id, orgId)),
            listLatest: (input) =>
              tenant((db) => new PostgresNotificationRepo(db).listLatest(input)),
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
        throw new ApiRouteError("NOT_FOUND", "Mailbox not found", 404);
      }
      return { data: result };
    },
  })(request);
}
