import type { AuthContext, PermissionRequest, SessionData } from "./types";

export type AuthProviderName = "better-auth" | "workos";

export type AuthProvider = {
  getSession(): Promise<SessionData | null>;
  getActiveOrg(): Promise<AuthContext | null>;
  hasPermission(permissions: PermissionRequest): Promise<boolean>;
};
