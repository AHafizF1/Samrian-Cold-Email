import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresAssignmentRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.campaignAssignments,
  async ({ orgId, db }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 50);
    const page = await new PostgresAssignmentRepo(db).listByCampaign(id, orgId, limit);
    return NextResponse.json({ page, isDone: true, continueCursor: null });
  }
);
