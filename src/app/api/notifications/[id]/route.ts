import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresNotificationRepo } from "@/server/repos";

export const PATCH = createSessionRoute(
  sessionOperations.notificationUpdate,
  async ({ db, orgId }, _request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;

    await new PostgresNotificationRepo(db).markRead(id, orgId);
    return NextResponse.json({ success: true });
  }
);
