import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { getThread, markThreadRead } from "@/server/modules/inbox";
import { createPostgresJobRepos } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.inboxRead,
  async (
    { orgId, userId, db },
    _request: Request,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await context.params;
    const repos = createPostgresJobRepos(db);

    return NextResponse.json(await getThread({ orgId, userId, threadId: id }, { repos }));
  }
);

export const PATCH = createSessionRoute(
  sessionOperations.inboxUpdate,
  async ({ orgId, userId, db }, request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const repos = createPostgresJobRepos(db);

    return NextResponse.json(
      await markThreadRead({ orgId, userId, threadId: id, read: body.read }, { repos })
    );
  }
);
