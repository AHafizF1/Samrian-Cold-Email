/**
 * SMTP Mailbox Connect API Route
 *
 * Handles form submissions for connecting SMTP/IMAP mailboxes.
 * Encrypts the password through the server credential Module, then stores
 * the encrypted blob through the Postgres mailbox repo.
 *
 * This ensures plaintext passwords never reach persistent storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { encryptCredential as encrypt } from "@/server/crypto";
import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { clampDailyLimit, getProviderPolicy } from "@/server/modules/providers";
import { PostgresMailboxRepo, PostgresSettingsRepo } from "@/server/repos";
import { newId } from "@/server/repos";

// Hardcoded SMTP/IMAP defaults per provider (optional - user can override)
const PROVIDER_DEFAULTS: Record<
  string,
  { smtpHost?: string; smtpPort?: number; imapHost?: string; imapPort?: number }
> = {
  puzzle: {
    smtpHost: "smtp.puzzle.io",
    smtpPort: 587,
    imapHost: "imap.puzzle.io",
    imapPort: 993,
  },
  mailpool: {
    smtpHost: "smtp.mailpool.com",
    smtpPort: 587,
    imapHost: "imap.mailpool.com",
    imapPort: 993,
  },
  smtp: {
    // Custom SMTP - no defaults, user must provide
  },
};

export const POST = createSessionRoute(
  sessionOperations.mailboxConnect,
  async ({ orgId, db }, request: NextRequest) => {
    let body: {
      name: string;
      provider: string;
      username: string;
      password: string;
      dailySendLimit: number;
      smtpHost?: string;
      smtpPort?: number;
      imapHost?: string;
      imapPort?: number;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Validate required fields
    if (!body.name || !body.provider || !body.username || !body.password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["puzzle", "mailpool", "smtp"].includes(body.provider)) {
      return NextResponse.json(
        { error: "Use OAuth for Google/Microsoft providers" },
        { status: 400 }
      );
    }

    // Apply provider defaults if not specified
    const defaults = PROVIDER_DEFAULTS[body.provider] || {};
    const smtpHost = body.smtpHost ?? defaults?.smtpHost;
    const smtpPort = body.smtpPort ?? defaults?.smtpPort ?? 587;
    const imapHost = body.imapHost ?? defaults?.imapHost;
    const imapPort = body.imapPort ?? defaults?.imapPort ?? 993;

    if (!smtpHost) {
      return NextResponse.json({ error: "SMTP host is required" }, { status: 400 });
    }
    if (!imapHost) {
      return NextResponse.json({ error: "IMAP host is required" }, { status: 400 });
    }

    const mailboxId = newId("mailbox");

    // Bind credential to tenant, mailbox, provider, and field before storage.
    let encryptedPassword: string;
    try {
      encryptedPassword = encrypt(body.password, {
        orgId,
        mailboxId,
        provider: body.provider as "smtp" | "puzzle" | "mailpool",
        purpose: "password",
      });
    } catch {
      return NextResponse.json({ error: "Encryption failed" }, { status: 500 });
    }

    try {
      const repo = new PostgresMailboxRepo(db);
      const sending = await new PostgresSettingsRepo(db).getSending(orgId);
      const provider = body.provider as "puzzle" | "mailpool" | "smtp";
      const requestedLimit =
        body.dailySendLimit ?? getProviderPolicy(provider).recommendedDailyLimit;
      const mailbox = await repo.create({
        id: mailboxId,
        orgId,
        name: body.name,
        provider,
        smtpHost,
        smtpPort,
        imapHost,
        imapPort,
        username: body.username,
        encryptedPassword,
        userEmail: body.username,
        dailySendLimit: clampDailyLimit(provider, requestedLimit),
        rampEnabled: sending.defaultRampEnabled,
        rampCurrentLimit: sending.defaultRampEnabled ? 5 : undefined,
        rampTargetLimit: Math.min(
          sending.defaultRampTarget,
          getProviderPolicy(provider).maxSafeDailyLimit
        ),
      });

      return NextResponse.json({ id: mailbox.id, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save mailbox";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
);
