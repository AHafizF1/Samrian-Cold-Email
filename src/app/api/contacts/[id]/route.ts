import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresAssignmentRepo, PostgresContactRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.contactRead,
  async ({ orgId, db }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const contact = await new PostgresContactRepo(db).getById(id, orgId);
    const page = await new PostgresAssignmentRepo(db).listByContact(id, orgId, 50);
    return NextResponse.json({
      contact: contact ? { ...contact, _id: contact.id } : null,
      history: { page },
    });
  }
);
