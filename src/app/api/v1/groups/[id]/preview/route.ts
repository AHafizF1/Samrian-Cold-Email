import { pageQuerySchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { PostgresGroupRepo } from "@/server/repos";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "groups.preview",
    credentials,
    handler: async ({ principal }) => {
      const parsed = pageQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams)
      );
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid page", 400);
      const { id } = await context.params;
      const repo = new PostgresGroupRepo(getDb());
      const group = await repo.getById(id, principal.orgId);
      if (!group) throw new ApiRouteError("NOT_FOUND", "Group not found", 404);
      const [count, contacts] = await Promise.all([
        repo.countContacts(id, principal.orgId),
        repo.sampleContacts(id, principal.orgId, parsed.data.limit),
      ]);
      return {
        data: {
          count,
          sample: contacts.map(({ id: contactId, email, domain }) => ({
            id: contactId,
            email,
            ...(domain ? { domain } : {}),
          })),
        },
      };
    },
  })(request);
}
