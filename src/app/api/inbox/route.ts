import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { listInbox } from "@/server/modules/inbox";
import { createPostgresJobRepos } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.inboxList,
  async ({ orgId, userId, db }, request: Request) => {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 50);
    const repos = createPostgresJobRepos(db);

    return NextResponse.json(await listInbox({ orgId, userId, limit }, { repos }));
  }
);
