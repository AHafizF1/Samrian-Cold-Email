import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresSettingsRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.sendingSettingsRead,
  async ({ db, orgId }) => {
    return NextResponse.json(await new PostgresSettingsRepo(db).getSending(orgId));
  }
);

export const PATCH = createSessionRoute(
  sessionOperations.sendingSettingsUpdate,
  async ({ db, orgId }, request: Request) => {
    const body = (await request.json()) as Record<string, unknown>;
    const repo = new PostgresSettingsRepo(db);
    return NextResponse.json(
      await repo.upsertSending(orgId, {
        defaultRampEnabled: body.defaultRampEnabled === true,
        defaultRampTarget: numberOr(body.defaultRampTarget, 30),
        replyReserve: numberOr(body.replyReserve, 2),
      })
    );
  }
);

function numberOr(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
