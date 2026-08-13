import type { PermissionRequest } from "./types";

export type SessionOperation =
  | {
      id: string;
      access: "authenticated";
    }
  | {
      id: string;
      access: "permission";
      permissions: PermissionRequest;
    };

const authenticated = (id: string): SessionOperation => ({ id, access: "authenticated" });
const permission = (id: string, permissions: PermissionRequest): SessionOperation => ({
  id,
  access: "permission",
  permissions,
});

export const sessionOperations = {
  analyticsExport: permission("analytics.export", { analytics: ["export"] }),
  analyticsRead: permission("analytics.read", { analytics: ["read"] }),
  blocklistCreate: permission("blocklist.create", { blocklist: ["create"] }),
  blocklistDelete: permission("blocklist.delete", { blocklist: ["delete"] }),
  blocklistList: permission("blocklist.list", { blocklist: ["read"] }),
  campaignAssignments: permission("campaign.assignments", { campaign: ["read"] }),
  campaignCreate: permission("campaign.create", { campaign: ["create"] }),
  campaignLaunch: permission("campaign.launch", { campaign: ["launch"] }),
  campaignList: permission("campaign.list", { campaign: ["read"] }),
  campaignRead: permission("campaign.read", { campaign: ["read"] }),
  campaignStats: permission("campaign.stats", { analytics: ["read"] }),
  campaignUpdate: permission("campaign.update", { campaign: ["update"] }),
  contactCreate: permission("contact.create", { contact: ["create"] }),
  contactDelete: permission("contact.delete", { contact: ["delete"] }),
  contactImport: permission("contact.import", { contact: ["import"] }),
  contactsList: permission("contact.list", { contact: ["read"] }),
  contactRead: permission("contact.read", { contact: ["read"] }),
  contactsUpdate: permission("contact.update", { contact: ["update"] }),
  credentialCreate: permission("credential.create", { credential: ["create"] }),
  credentialList: permission("credential.list", { credential: ["read"] }),
  credentialRevoke: permission("credential.revoke", { credential: ["delete"] }),
  domainCheck: permission("domain.check", { domain: ["check"] }),
  groupCreate: permission("group.create", { group: ["create"] }),
  groupList: permission("group.list", { group: ["read"] }),
  groupPreview: permission("group.preview", { group: ["read"] }),
  groupRead: permission("group.read", { group: ["read"] }),
  groupUpdate: permission("group.update", { group: ["update"] }),
  inboxList: permission("inbox.list", { inbox: ["read"] }),
  inboxRead: permission("inbox.read", { inbox: ["read"] }),
  inboxReply: permission("inbox.reply", { inbox: ["reply"] }),
  inboxUpdate: permission("inbox.update", { inbox: ["update"] }),
  mailboxArchive: permission("mailbox.archive", { mailbox: ["delete"] }),
  mailboxCheck: permission("mailbox.check", { mailbox: ["update"] }),
  mailboxConnect: permission("mailbox.connect", { mailbox: ["create"] }),
  mailboxList: permission("mailbox.list", { mailbox: ["read"] }),
  mailboxRampRead: permission("mailbox.ramp.read", { mailbox: ["read"] }),
  mailboxRampUpdate: permission("mailbox.ramp.update", { mailbox: ["update"] }),
  mailboxReconnect: permission("mailbox.reconnect", { mailbox: ["update"] }),
  notificationList: authenticated("notification.list"),
  notificationUpdate: authenticated("notification.update"),
  notificationUpdateAll: authenticated("notification.update-all"),
  roleCreate: permission("role.create", { ac: ["create"] }),
  roleDelete: permission("role.delete", { ac: ["delete"] }),
  roleList: permission("role.list", { settings: ["read"] }),
  roleUpdate: permission("role.update", { ac: ["update"] }),
  memberInvite: permission("member.invite", { invitation: ["create"] }),
  memberList: permission("member.list", { settings: ["read"] }),
  memberUpdate: permission("member.update", { member: ["update"] }),
  complianceRead: permission("settings.compliance.read", { settings: ["read"] }),
  complianceUpdate: permission("settings.compliance.update", { settings: ["update"] }),
  notificationSettingsRead: authenticated("settings.notifications.read"),
  notificationSettingsUpdate: authenticated("settings.notifications.update"),
  sendingSettingsRead: permission("settings.sending.read", { settings: ["read"] }),
  sendingSettingsUpdate: permission("settings.sending.update", { settings: ["update"] }),
} as const satisfies Record<string, SessionOperation>;

export function getOperationPermissions(operation: SessionOperation) {
  return operation.access === "permission" ? operation.permissions : undefined;
}
