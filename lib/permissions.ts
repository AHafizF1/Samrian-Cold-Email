import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  ownerAc,
  adminAc,
  memberAc,
} from "better-auth/plugins/organization/access";

// ONE source of truth for permissions (shared server + client)
const statement = {
  ...defaultStatements,
  mailbox: ["create", "read", "update", "delete"],
  campaign: ["create", "read", "update", "delete", "launch", "pause"],
  contact: ["create", "read", "update", "delete", "import"],
  credential: ["create", "read", "delete"],
  group: ["create", "read", "update", "delete"],
  blocklist: ["create", "read", "delete"],
  inbox: ["read", "update", "reply"],
  analytics: ["read", "export"],
  domain: ["read", "check"],
  notification: ["read", "update"],
  settings: ["read", "update"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  ...ownerAc.statements,
  mailbox: ["create", "read", "update", "delete"],
  campaign: ["create", "read", "update", "delete", "launch", "pause"],
  contact: ["create", "read", "update", "delete", "import"],
  credential: ["create", "read", "delete"],
  group: ["create", "read", "update", "delete"],
  blocklist: ["create", "read", "delete"],
  inbox: ["read", "update", "reply"],
  analytics: ["read", "export"],
  domain: ["read", "check"],
  notification: ["read", "update"],
  settings: ["read", "update"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  mailbox: ["create", "read", "update", "delete"],
  campaign: ["create", "read", "update", "delete", "launch", "pause"],
  contact: ["create", "read", "update", "delete", "import"],
  credential: ["create", "read", "delete"],
  group: ["create", "read", "update", "delete"],
  blocklist: ["create", "read", "delete"],
  inbox: ["read", "update", "reply"],
  analytics: ["read", "export"],
  domain: ["read", "check"],
  notification: ["read", "update"],
  settings: ["read"],
});

export const member = ac.newRole({
  ...memberAc.statements,
  mailbox: ["read"],
  campaign: ["create", "read", "update", "launch", "pause"],
  contact: ["read"],
  group: ["read"],
  blocklist: ["read"],
  inbox: ["read", "update", "reply"],
  analytics: ["read"],
  domain: ["read"],
  notification: ["read", "update"],
  settings: ["read"],
});

export const permissionCatalog = statement;
