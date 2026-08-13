import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDomainReadiness, normalizeDomain } from "@/server/modules/domains";
import { createDomainPort } from "@/server/repos";

export async function POST(request: Request, context: { params: Promise<{ domain: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "domains.check",
    credentials,
    transaction: "explicit",
    handler: async ({ principal, tenant }) => {
      const { domain } = await context.params;
      const normalized = normalizeDomain(domain);
      if (!normalized) {
        throw new ApiRouteError("VALIDATION_FAILED", "Invalid domain", 400);
      }
      return {
        data: await getDomainReadiness(
          { orgId: principal.orgId, domain: normalized },
          { domains: createDomainPort(tenant) }
        ),
      };
    },
  })(request);
}
