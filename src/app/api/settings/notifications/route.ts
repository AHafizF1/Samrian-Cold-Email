import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresSettingsRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.notificationSettingsRead,
  async ({ db, orgId, userId }) => {
    return NextResponse.json(
      await new PostgresSettingsRepo(db).getNotificationPrefs(orgId, userId)
    );
  }
);

export const PATCH = createSessionRoute(
  sessionOperations.notificationSettingsUpdate,
  async ({ db, orgId, userId }, request: Request) => {
    const body = await request.json();
    const repo = new PostgresSettingsRepo(db);

    const prefs = await repo.upsertNotificationPrefs(orgId, userId, {
      replyInAppEnabled: Boolean(body.replyInAppEnabled ?? true),
      replyForwardEnabled: Boolean(body.replyForwardEnabled),
      replyForwardEmails: Array.isArray(body.replyForwardEmails) ? body.replyForwardEmails : [],
      browserPushEnabled: Boolean(body.browserPushEnabled),
    });

    return NextResponse.json(prefs);
  }
);
