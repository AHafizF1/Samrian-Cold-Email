import type { OrgId, UserId } from "../ports";

export type NotificationPrefs = {
  orgId: OrgId;
  userId: UserId;
  replyInAppEnabled: boolean;
  replyForwardEnabled: boolean;
  replyForwardEmails: string[];
  browserPushEnabled: boolean;
};

export function getDefaultNotificationPrefs(orgId: OrgId, userId: UserId): NotificationPrefs {
  return {
    orgId,
    userId,
    replyInAppEnabled: true,
    replyForwardEnabled: false,
    replyForwardEmails: [],
    browserPushEnabled: false,
  };
}

export function normalizeNotificationPrefs(
  input: Partial<NotificationPrefs> & {
    orgId: OrgId;
    userId: UserId;
  }
): NotificationPrefs {
  return {
    ...getDefaultNotificationPrefs(input.orgId, input.userId),
    ...input,
    replyForwardEmails: normalizeEmails(input.replyForwardEmails ?? []),
  };
}

export function shouldForwardReply(prefs: NotificationPrefs): boolean {
  return prefs.replyForwardEnabled && prefs.replyForwardEmails.length > 0;
}

function normalizeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of emails) {
    const email = value.trim().toLowerCase();
    if (!isEmail(email) || seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }

  return result;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
