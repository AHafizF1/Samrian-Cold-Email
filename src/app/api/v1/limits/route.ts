import { createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { readLimitConfig } from "@/server/limits/config";
import { getTierLimits } from "@/server/modules/limits";

export async function GET(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "limits.get",
    credentials,
    handler: async () => {
      const config = readLimitConfig();
      return {
        data: {
          mode: config.mode,
          tier: config.tier,
          ...getTierLimits(config.tier),
        },
      };
    },
  })(request);
}
