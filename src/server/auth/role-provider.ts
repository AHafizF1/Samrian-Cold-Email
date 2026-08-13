export type AppRole = {
  id: string;
  name: string;
  slug: string;
  permissions: string[];
  builtIn: boolean;
};

export type AppMember = {
  id: string;
  userId: string;
  email?: string;
  name?: string;
  role: string;
};

export interface RoleProvider {
  listRoles(orgId: string): Promise<AppRole[]>;
  createRole(input: {
    orgId: string;
    name: string;
    slug: string;
    permissions: string[];
  }): Promise<AppRole>;
  updateRole(input: {
    orgId: string;
    id: string;
    name?: string;
    permissions?: string[];
  }): Promise<AppRole>;
  deleteRole(input: { orgId: string; id: string }): Promise<void>;
  listMembers(orgId: string): Promise<AppMember[]>;
  updateMemberRole(input: { orgId: string; memberId: string; role: string }): Promise<void>;
  inviteMember(input: {
    orgId: string;
    email: string;
    role: string;
    inviterUserId: string;
  }): Promise<void>;
}
