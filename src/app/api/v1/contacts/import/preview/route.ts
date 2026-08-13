import { contactImportSchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { previewContacts } from "@/server/modules/contacts";
import { createContactImportDeps } from "@/server/repos";
import { createEmailVerifier } from "@/server/verify/email";

export async function POST(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "contacts.import-preview",
    credentials,
    transaction: "explicit",
    bodyLimitBytes: 2 * 1024 * 1024,
    handler: async ({ principal, tenant, request }) => {
      const parsed = contactImportSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) {
        throw new ApiRouteError("VALIDATION_FAILED", "Invalid contact import", 400);
      }
      return {
        data: await previewContacts(
          { orgId: principal.orgId, rows: parsed.data.contacts },
          createContactImportDeps(tenant, createEmailVerifier())
        ),
      };
    },
  })(request);
}
