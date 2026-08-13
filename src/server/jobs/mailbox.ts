import { checkMailbox, type CheckMailboxDeps, type CheckMailboxResult } from "../modules/mailboxes";
import type { MailboxId, OrgId } from "../ports";

export type MailboxHealthPayload = {
  mailboxId: MailboxId;
  orgId: OrgId;
};

export type CheckMailboxHealthDeps = CheckMailboxDeps;

export async function checkMailboxHealth(
  payload: MailboxHealthPayload,
  deps: CheckMailboxHealthDeps
): Promise<CheckMailboxResult> {
  return checkMailbox(payload, deps);
}
