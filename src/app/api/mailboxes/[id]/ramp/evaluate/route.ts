import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { evaluateRamp } from "@/server/modules/ramp";
import { PostgresEventRepo, PostgresMailboxRepo } from "@/server/repos";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const POST = createSessionRoute(
  sessionOperations.mailboxRampUpdate,
  async ({ db, orgId }, _request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const mailboxes = new PostgresMailboxRepo(db);
    const mailbox = await mailboxes.getById(id, orgId);
    if (!mailbox) return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });

    const now = Date.now();
    const evidence = await new PostgresEventRepo(db).getMailboxRampEvidence(
      id,
      orgId,
      now - WEEK_MS
    );
    const decision = evaluateRamp({
      enabled: mailbox.rampEnabled ?? false,
      status: asStatus(mailbox.rampStatus),
      mailboxStatus: mailbox.status ?? "active",
      startedAt: mailbox.rampStartedAt,
      currentLimit: mailbox.rampCurrentLimit ?? 5,
      targetLimit: mailbox.rampTargetLimit ?? 30,
      increment: mailbox.rampIncrement ?? 5,
      nextCheckAt: mailbox.rampNextCheckAt,
      providerLimitResetAt: mailbox.providerLimitResetAt,
      archived: Boolean(mailbox.archivedAt),
      domainStatus: "unknown",
      now,
      ...evidence,
    });
    await mailboxes.updateRamp(id, orgId, decision, mailbox.rampNextCheckAt);
    return NextResponse.json({ decision, mailbox: await mailboxes.getById(id, orgId) });
  }
);

function asStatus(value?: string) {
  if (
    value === "disabled" ||
    value === "pending" ||
    value === "ramping" ||
    value === "ready" ||
    value === "held" ||
    value === "reduced" ||
    value === "paused" ||
    value === "recovering"
  ) {
    return value;
  }
  return "pending";
}
