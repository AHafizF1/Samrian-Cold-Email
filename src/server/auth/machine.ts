import type { Scope } from "@samrian/contracts";

export type AutomationPrincipal = {
  credentialId: string;
  provider: "better-auth" | "workos";
  orgId: string;
  userId?: string;
  scopes: Scope[];
  expiresAt?: string;
};

export type MachineCredential = {
  create(input: CreateCredential): Promise<CreatedCredential>;
  list(input: { orgId: string }): Promise<CredentialMetadata[]>;
  verify(value: string): Promise<AutomationPrincipal | null>;
  revoke(input: { orgId: string; id: string }): Promise<CredentialRevocation>;
};

export type CredentialRevocation = {
  revoked: true;
  reversible: boolean;
  provider: AutomationPrincipal["provider"];
};

export type CreateCredential = {
  orgId: string;
  userId: string;
  name: string;
  scopes: Scope[];
};

export type CredentialMetadata = {
  id: string;
  name: string;
  scopes: Scope[];
  createdAt: string;
  obfuscatedValue?: string;
  expiresAt?: string;
};

export type CreatedCredential = CredentialMetadata & { value: string };

export function extractBearerCredential(headers: Headers): string {
  const value = headers.get("authorization");
  const match = value?.match(/^Bearer ([^\s]+)$/);
  if (!match) throw new Error("Bearer credential required");
  return match[1];
}

export function hasScopes(principal: AutomationPrincipal, required: readonly Scope[]): boolean {
  return required.every((scope) => principal.scopes.includes(scope));
}
