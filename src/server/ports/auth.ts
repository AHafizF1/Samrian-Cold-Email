import type { OrgId, UserId } from "./ids";

export type Permission =
  | "campaign:read"
  | "campaign:write"
  | "contact:read"
  | "contact:write"
  | "mailbox:read"
  | "mailbox:write"
  | "thread:read"
  | "thread:write"
  | "admin";

export type AuthContext = {
  orgId: OrgId;
  userId: UserId;
  permissions: readonly Permission[];
};

export interface AuthPort {
  requireUser(): Promise<AuthContext>;
  requirePermission(permission: Permission): Promise<AuthContext>;
}
