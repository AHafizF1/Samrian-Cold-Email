import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresSettingsRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.complianceRead,
  async ({ db, orgId }, _request?: Request) => {
    const repo = new PostgresSettingsRepo(db);
    return NextResponse.json(await repo.getCompliance(orgId));
  }
);

export const PATCH = createSessionRoute(
  sessionOperations.complianceUpdate,
  async ({ db, orgId }, request: Request) => {
    const body = await request.json();
    const repo = new PostgresSettingsRepo(db);

    await repo.upsertCompliance(orgId, {
      listUnsubscribeEnabled: Boolean(body.listUnsubscribeEnabled),
      clickTrackingEnabled: Boolean(body.clickTrackingEnabled),
      openTrackingEnabled: Boolean(body.openTrackingEnabled),
      physicalAddress: nullableString(body.physicalAddress),
      defaultSenderName: nullableString(body.defaultSenderName),
      unsubscribeFooter: nullableString(body.unsubscribeFooter),
      unsubscribeMailto: nullableString(body.unsubscribeMailto),
      bouncePauseRate: numberOr(body.bouncePauseRate, 0.05),
      unsubscribePauseRate: numberOr(body.unsubscribePauseRate, 0.1),
      complaintPauseRate: numberOr(body.complaintPauseRate, 0.001),
    });

    return NextResponse.json(await repo.getCompliance(orgId));
  }
);

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOr(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
