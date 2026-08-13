import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresGroupRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.groupPreview,
  async ({ orgId, db }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 10);
    const repo = new PostgresGroupRepo(db);
    const [count, sample] = await Promise.all([
      repo.countContacts(id, orgId),
      repo.sampleContacts(id, orgId, limit),
    ]);

    return NextResponse.json({ count, sample });
  }
);
