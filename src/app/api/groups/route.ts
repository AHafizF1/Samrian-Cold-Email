import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresGroupRepo } from "@/server/repos";

export const GET = createSessionRoute(sessionOperations.groupList, async ({ orgId, db }) => {
  const groups = await new PostgresGroupRepo(db).list(orgId);
  return NextResponse.json({ groups });
});

export const POST = createSessionRoute(
  sessionOperations.groupCreate,
  async ({ orgId, userId, db }, request: Request) => {
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      rules?: unknown;
      logic?: "AND" | "OR";
      isDynamic?: boolean;
      contactIds?: string[];
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const group = await new PostgresGroupRepo(db).create({
      orgId,
      name: body.name.trim(),
      description: body.description,
      rules: body.rules ?? [],
      logic: body.logic ?? "AND",
      isDynamic: body.isDynamic ?? false,
      contactIds: body.contactIds,
      createdBy: userId,
    });

    return NextResponse.json({ group }, { status: 201 });
  }
);
