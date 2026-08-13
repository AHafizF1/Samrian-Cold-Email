import { contactListQuerySchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { decodeCursor, encodeCursor } from "@/server/api/cursor";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { PostgresContactRepo } from "@/server/repos";

export async function GET(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "contacts.list",
    credentials,
    handler: async ({ principal }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      const parsed = contactListQuerySchema.safeParse(query);
      if (!parsed.success) {
        throw new ApiRouteError("VALIDATION_FAILED", "Invalid contact list query", 400);
      }

      let cursor;
      try {
        cursor = parsed.data.cursor ? decodeCursor(parsed.data.cursor) : undefined;
      } catch {
        throw new ApiRouteError("VALIDATION_FAILED", "Invalid cursor", 400);
      }

      const page = await new PostgresContactRepo(getDb()).listPage(principal.orgId, {
        limit: parsed.data.limit,
        cursor,
      });
      return {
        data: {
          items: page.items.map(
            ({
              id,
              email,
              domain,
              customVars,
              timezone,
              bounceStatus,
              verificationStatus,
              createdAt,
            }) => ({
              id,
              email,
              ...(domain ? { domain } : {}),
              ...(customVars ? { customVars } : {}),
              ...(timezone ? { timezone } : {}),
              ...(bounceStatus ? { bounceStatus } : {}),
              ...(verificationStatus ? { verificationStatus } : {}),
              createdAt,
            })
          ),
        },
        ...(page.nextCursor ? { nextCursor: encodeCursor(page.nextCursor) } : {}),
      };
    },
  })(request);
}
