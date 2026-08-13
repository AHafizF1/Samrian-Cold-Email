import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresGroupRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.groupRead,
  async ({ orgId, db }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const repo = new PostgresGroupRepo(db);
    const group = await repo.getById(id, orgId);
    const count = await repo.countContacts(id, orgId);
    return NextResponse.json({ group, count });
  }
);

export const PATCH = createSessionRoute(
  sessionOperations.groupUpdate,
  async ({ orgId, db }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
      rules?: unknown;
      logic?: "AND" | "OR";
      isDynamic?: boolean;
      contactIds?: string[];
    };

    const group = await new PostgresGroupRepo(db).update(id, orgId, body);
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    return NextResponse.json({ group });
  }
);
