import { decryptCredential as decrypt } from "@/server/crypto";
import type { PostgresMailboxRepo } from "@/server/repos";
import { deadlineSignal } from "@/server/network/deadline";

const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export async function revokeMailboxToken(
  repo: PostgresMailboxRepo,
  mailboxId: string,
  orgId: string
): Promise<void> {
  const token = await getMailboxRevocationToken(repo, mailboxId, orgId);
  if (token) await revokeGoogleToken(token);
}

export async function getMailboxRevocationToken(
  repo: PostgresMailboxRepo,
  mailboxId: string,
  orgId: string
): Promise<string | undefined> {
  const row = await repo.getRawById(mailboxId, orgId);
  if (!row || row.provider !== "google") return undefined;

  return row.encryptedRefreshToken
    ? decrypt(row.encryptedRefreshToken, {
        orgId,
        mailboxId,
        provider: row.provider,
        purpose: "refresh-token",
      })
    : row.encryptedAccessToken
      ? decrypt(row.encryptedAccessToken, {
          orgId,
          mailboxId,
          provider: row.provider,
          purpose: "access-token",
        })
      : undefined;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: deadlineSignal(),
  });
}
