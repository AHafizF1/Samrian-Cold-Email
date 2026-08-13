import { NextRequest, NextResponse } from "next/server";

import { encryptCredential as encrypt } from "@/server/crypto";
import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { reconnectMailbox } from "@/server/modules/mailboxes";
import { PostgresMailboxRepo } from "@/server/repos";

export const POST = createSessionRoute(
  sessionOperations.mailboxReconnect,
  async ({ orgId, db }, request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const repo = new PostgresMailboxRepo(db);
    const mailbox = await repo.getRawById(id, orgId);
    if (!mailbox) return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });

    if (mailbox.provider === "google" || mailbox.provider === "microsoft") {
      return NextResponse.json({
        reconnectUrl: `/api/auth/${mailbox.provider}?mailboxId=${encodeURIComponent(id)}`,
      });
    }

    const body = await request.json().catch(() => null);
    if (!body?.password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    await reconnectMailbox(
      {
        mailboxId: id,
        orgId,
        encryptedRefreshToken: undefined,
        encryptedPassword: encrypt(body.password, {
          orgId,
          mailboxId: id,
          provider: mailbox.provider,
          purpose: "password",
        }),
        smtpHost: body.smtpHost ?? mailbox.smtpHost ?? undefined,
        smtpPort: body.smtpPort ?? mailbox.smtpPort ?? undefined,
        imapHost: body.imapHost ?? mailbox.imapHost ?? undefined,
        imapPort: body.imapPort ?? mailbox.imapPort ?? undefined,
        username: body.username ?? mailbox.username ?? undefined,
        userEmail: body.username ?? mailbox.userEmail ?? undefined,
      },
      { repos: { mailboxes: repo } }
    );

    return NextResponse.json({ status: "reconnected" });
  }
);
