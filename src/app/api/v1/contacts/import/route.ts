import { contactImportSchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { importContacts } from "@/server/modules/contacts";
import { createContactImportDeps, PostgresIdempotencyStore } from "@/server/repos";
import { createEmailVerifier } from "@/server/verify/email";

export async function POST(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "contacts.import",
    credentials,
    idempotency: ({ principal, operation }) =>
      new PostgresIdempotencyStore(getDb(), {
        orgId: principal.orgId,
        credentialId: principal.credentialId,
        operationId: operation.id,
      }),
    transaction: "explicit",
    bodyLimitBytes: 2 * 1024 * 1024,
    handler: async ({ principal, tenant, request }) => {
      const parsed = contactImportSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) {
        throw new ApiRouteError("VALIDATION_FAILED", "Invalid contact import", 400);
      }
      const data = await importContacts(
        { orgId: principal.orgId, rows: parsed.data.contacts },
        createContactImportDeps(tenant, createEmailVerifier())
      );
      return { data };
    },
  })(request);
}
