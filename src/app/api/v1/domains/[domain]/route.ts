import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { normalizeDomain } from "@/server/modules/domains";
import { PostgresDomainRepo } from "@/server/repos";

export async function GET(request: Request, context: { params: Promise<{ domain: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "domains.get",
    credentials,
    handler: async ({ principal }) => {
      const { domain } = await context.params;
      const normalized = normalizeDomain(domain);
      if (!normalized) throw new ApiRouteError("VALIDATION_FAILED", "Invalid domain", 400);
      return { data: await new PostgresDomainRepo(getDb()).get(principal.orgId, normalized) };
    },
  })(request);
}
