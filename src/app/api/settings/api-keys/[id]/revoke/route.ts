import { createSessionAction } from "@/server/api/session-route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { sessionOperations } from "@/server/auth/policy";
import { revokeApiKey } from "@/server/modules/api-keys";

export const POST = createSessionAction(
  sessionOperations.credentialRevoke,
  async (actor, request: Request, context: { params: Promise<{ id: string }> }) => {
    const provider = await getMachineCredential(request.headers);
    const { id } = await context.params;
    return Response.json(await revokeApiKey(id, { actor, provider }));
  }
);
