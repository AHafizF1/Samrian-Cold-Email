import { createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";

export async function GET(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "identity.me",
    credentials,
    handler: async ({ principal }) => ({
      data: {
        credentialId: principal.credentialId,
        orgId: principal.orgId,
        ...(principal.userId ? { userId: principal.userId } : {}),
        scopes: principal.scopes,
      },
    }),
  })(request);
}
