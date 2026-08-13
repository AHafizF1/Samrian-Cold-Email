import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresNotificationRepo } from "@/server/repos";

export const POST = createSessionRoute(
  sessionOperations.notificationUpdateAll,
  async ({ db, orgId, userId }) => {
    const count = await new PostgresNotificationRepo(db).markAllRead({ orgId, userId });
    return NextResponse.json({ success: true, count });
  }
);
