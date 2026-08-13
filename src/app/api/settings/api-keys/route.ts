import { scopes } from "@samrian/contracts";
import { z } from "zod";

import { createSessionAction } from "@/server/api/session-route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { sessionOperations } from "@/server/auth/policy";
import { createApiKey, listApiKeys } from "@/server/modules/api-keys";

const createSchema = z
  .object({ name: z.string().trim().min(1).max(80), scopes: z.array(z.enum(scopes)).min(1) })
  .strict();

export const GET = createSessionAction(
  sessionOperations.credentialList,
  async (actor, request: Request) => {
    const provider = await getMachineCredential(request.headers);
    return Response.json(await listApiKeys({ actor, provider }));
  }
);

export const POST = createSessionAction(
  sessionOperations.credentialCreate,
  async (actor, request: Request) => {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid API key" }, { status: 400 });

    const provider = await getMachineCredential(request.headers);
    return Response.json(await createApiKey(parsed.data, { actor, provider }), { status: 201 });
  }
);
