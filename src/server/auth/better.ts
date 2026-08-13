import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { organization } from "better-auth/plugins";
import { headers } from "next/headers";

import { ac, admin, member, owner } from "../../../lib/permissions";
import { getAuthDb } from "../db/db";
import * as schema from "../db/schema";
import { getGoogleAuthConfig } from "./config";
import type { AuthProvider } from "./port";
import type { PermissionRequest, SessionData } from "./types";

export function createAuthOptions(params?: { database?: BetterAuthOptions["database"] }) {
  const google = getGoogleAuthConfig();

  return {
    appName: "ColdEmail MVP",
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"],
    database:
      params?.database ??
      drizzleAdapter(getAuthDb(), {
        provider: "pg",
        usePlural: true,
        schema,
      }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    ...(google.enabled
      ? {
          socialProviders: {
            google: {
              clientId: google.clientId,
              clientSecret: google.clientSecret,
            },
          },
        }
      : {}),
    plugins: [
      apiKey({
        configId: "automation",
        references: "organization",
        enableSessionForAPIKeys: false,
        // Samrian's API boundary owns tier-aware distributed limits. Better
        // Auth's separate key counter duplicates policy and requires adapter
        // atomic-increment support unavailable in its official Drizzle adapter.
        rateLimit: { enabled: false },
      }),
      organization({
        ac,
        roles: {
          owner,
          admin,
          member,
        },
        allowUserToCreateOrganization: true,
        creatorRole: "owner",
        membershipLimit: 100,
        invitationExpiresIn: 60 * 60 * 24 * 7,
        dynamicAccessControl: {
          enabled: true,
          maximumRolesPerOrganization: 20,
        },
        async sendInvitationEmail(data) {
          console.log("Invitation email:", {
            to: data.email,
            inviter: data.inviter.user.email,
            organization: data.organization.name,
            invitationId: data.id,
          });
        },
      }),
    ],
  } satisfies BetterAuthOptions;
}

export function createBetterAuth() {
  return betterAuth(createAuthOptions());
}

export function createBetterAuthProvider(auth = createBetterAuth()): AuthProvider {
  async function getSession(): Promise<SessionData | null> {
    return (await auth.api.getSession({ headers: await headers() })) as SessionData | null;
  }

  return {
    getSession,
    async getActiveOrg() {
      const session = await getSession();
      const orgId = session?.session.activeOrganizationId;

      if (!session?.user || !orgId) {
        return null;
      }

      const activeMember = await auth.api
        .getActiveMember({ headers: await headers() })
        .catch(() => null);

      if (
        !activeMember ||
        activeMember.userId !== session.user.id ||
        activeMember.organizationId !== orgId
      ) {
        return null;
      }

      return {
        userId: session.user.id,
        orgId,
        role: activeMember.role,
        roles: [activeMember.role],
      };
    },
    async hasPermission(permissions: PermissionRequest) {
      return !!(await auth.api.hasPermission({
        body: { permissions },
        headers: await headers(),
      }));
    },
  };
}
