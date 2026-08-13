import { pageQuerySchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { PostgresMailboxRepo } from "@/server/repos";

export async function GET(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "mailboxes.list",
    credentials,
    handler: async ({ principal }) => {
      const parsed = pageQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams)
      );
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid page", 400);
      const items = await new PostgresMailboxRepo(getDb()).listItems(
        principal.orgId,
        parsed.data.limit
      );
      return {
        data: {
          items: items.map(({ _id, userEmail, ...item }) => ({
            id: _id,
            ...item,
            ...(userEmail ? { email: userEmail } : {}),
          })),
        },
      };
    },
  })(request);
}
