import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresBlocklistRepo } from "@/server/repos";

export const GET = createSessionRoute(sessionOperations.blocklistList, async ({ orgId, db }) => {
  const entries = await new PostgresBlocklistRepo(db).listEntries(orgId, 100);
  return NextResponse.json({ page: entries });
});

export const POST = createSessionRoute(
  sessionOperations.blocklistCreate,
  async ({ orgId, db }, request: Request) => {
    const body = (await request.json()) as { email?: string; reason?: string };

    if (!body.email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    await new PostgresBlocklistRepo(db).add({
      orgId,
      email: body.email,
      reason: body.reason ?? "manual",
    });
    return NextResponse.json({ success: true });
  }
);

export const DELETE = createSessionRoute(
  sessionOperations.blocklistDelete,
  async ({ orgId, db }, request: Request) => {
    const body = (await request.json()) as { email?: string };

    if (!body.email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const removed = await new PostgresBlocklistRepo(db).remove(body.email, orgId);
    return NextResponse.json({ success: removed });
  }
);
