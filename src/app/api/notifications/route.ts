import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresNotificationRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.notificationList,
  async ({ db, orgId, userId }, request: Request) => {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 10);
    const repo = new PostgresNotificationRepo(db);

    const [notifications, unreadCount] = await Promise.all([
      repo.listLatest({ orgId, userId, limit }),
      repo.countUnread({ orgId, userId }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  }
);
