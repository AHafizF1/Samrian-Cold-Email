import { operations } from "@samrian/contracts";

import { createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";

export async function GET(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "capabilities.get",
    credentials,
    handler: async () => ({
      data: {
        version: "v1" as const,
        operations: operations.map(({ response: _response, ...operation }) => operation),
      },
    }),
  })(request);
}
