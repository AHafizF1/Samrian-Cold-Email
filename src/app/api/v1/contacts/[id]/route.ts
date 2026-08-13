import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { PostgresContactRepo } from "@/server/repos";
import { contactUpdateSchema } from "@samrian/contracts";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "contacts.get",
    credentials,
    handler: async ({ principal }) => {
      const { id } = await context.params;
      const item = await new PostgresContactRepo(getDb()).getItemById(id, principal.orgId);
      if (!item) throw new ApiRouteError("NOT_FOUND", "Contact not found", 404);

      return { data: toPublicContact(item) };
    },
  })(request);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "contacts.update",
    credentials,
    handler: async ({ principal, request }) => {
      const parsed = contactUpdateSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid contact", 400);
      const { id } = await context.params;
      const repo = new PostgresContactRepo(getDb());
      if (!(await repo.update(id, principal.orgId, parsed.data))) {
        throw new ApiRouteError("NOT_FOUND", "Contact not found", 404);
      }
      const item = await repo.getItemById(id, principal.orgId);
      if (!item) throw new ApiRouteError("NOT_FOUND", "Contact not found", 404);
      return { data: toPublicContact(item) };
    },
  })(request);
}

function toPublicContact(item: Awaited<ReturnType<PostgresContactRepo["getItemById"]>> & {}) {
  if (!item) throw new Error("Contact not found");
  const { email, domain, customVars, timezone, bounceStatus, verificationStatus, createdAt } = item;
  return {
    id: item.id,
    email,
    ...(domain ? { domain } : {}),
    ...(customVars ? { customVars } : {}),
    ...(timezone ? { timezone } : {}),
    ...(bounceStatus ? { bounceStatus } : {}),
    ...(verificationStatus ? { verificationStatus } : {}),
    createdAt,
  };
}
