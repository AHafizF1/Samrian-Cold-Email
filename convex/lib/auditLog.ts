/**
 * Audit Logger — SOC2 Compliance (DRY)
 *
 * A single reusable function that every high-privilege mutation calls
 * to record an entry in the `auditLogs` table.
 *
 * High-privilege actions per plan §1.4:
 *   - Modifying encryption keys
 *   - Deleting a mailbox
 *   - Deleting a campaign
 *   - Deleting a contact
 *   - Exporting a CSV of contacts
 *   - Modifying org settings
 *   - Adding to / removing from do-not-contact list
 */
import { MutationCtx } from "../_generated/server";

export type AuditAction =
  | "mailbox.create"
  | "mailbox.update"
  | "mailbox.delete"
  | "mailbox.status_change"
  | "campaign.create"
  | "campaign.update"
  | "campaign.delete"
  | "campaign.status_change"
  | "contact.delete"
  | "contact.bulk_create"
  | "dnc.add"
  | "dnc.remove"
  | "org_settings.update"
  | "encryption_key.rotate";

/**
 * Write an audit log entry.
 *
 * Call this AFTER the mutation succeeds to avoid logging failed attempts.
 * Accepts a structured `details` string describing what changed.
 */
export async function writeAuditLog(
  ctx: MutationCtx,
  opts: {
    orgId: string;
    userId: string;
    action: AuditAction;
    details: string;
  }
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    orgId: opts.orgId,
    userId: opts.userId,
    action: opts.action,
    details: opts.details,
    timestamp: Date.now(),
  });
}
