import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresMailboxRepo } from "@/server/repos";

const actions = ["enable", "disable", "pause", "resume", "reset", "update"] as const;
type RampAction = (typeof actions)[number];

export const GET = createSessionRoute(
  sessionOperations.mailboxRampRead,
  async ({ db, orgId }, _request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const mailbox = await new PostgresMailboxRepo(db).getById(id, orgId);
    if (!mailbox) return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    return NextResponse.json(mailbox);
  }
);

export const PATCH = createSessionRoute(
  sessionOperations.mailboxRampUpdate,
  async ({ db, orgId }, request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = asAction(body.action);
    if (!action) return NextResponse.json({ error: "Invalid ramp action" }, { status: 400 });

    const repo = new PostgresMailboxRepo(db);
    const mailbox = await repo.getById(id, orgId);
    if (!mailbox) return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    await repo.configureRamp(id, orgId, {
      action,
      targetLimit: numberOr(body.targetLimit, mailbox.rampTargetLimit ?? 30),
      now: Date.now(),
    });
    return NextResponse.json(await repo.getById(id, orgId));
  }
);

function asAction(value: unknown): RampAction | null {
  return actions.includes(value as RampAction) ? (value as RampAction) : null;
}

function numberOr(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
