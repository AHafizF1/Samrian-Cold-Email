export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export type SessionData = {
  user: SessionUser;
  session: {
    activeOrganizationId?: string | null;
    roles?: OrgRole[];
    permissions?: string[];
  };
};

export type OrgRole = "owner" | "admin" | "member" | string;

export type AuthContext = {
  userId: string;
  orgId: string;
  role: OrgRole;
  roles?: OrgRole[];
  permissions?: string[];
};

export type PermissionRequest = Record<string, string[]>;

export type AuthDeps = {
  getSession(): Promise<SessionData | null>;
  getMember?(input: { userId: string; orgId: string }): Promise<{ role: OrgRole } | null>;
  hasPermission?(permissions: PermissionRequest): Promise<boolean>;
};
