import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import { ac, owner, admin, member } from "../../lib/permissions";
import schema from "./schema";

export const authComponent = createClient<DataModel, typeof schema>(components.betterAuth, {
  local: { schema },
  verbose: false,
});

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    appName: "ColdEmail MVP",
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      convex({ authConfig }),
      organization({
        ac,
        roles: {
          owner,
          admin,
          member,
        },
        // Allow any authenticated user to create an organization
        allowUserToCreateOrganization: true,
        // Set creator as owner
        creatorRole: "owner",
        // Limit members per org (can be made dynamic later)
        membershipLimit: 100,
        // Invitation expires in 7 days
        invitationExpiresIn: 60 * 60 * 24 * 7,
        // Send invitation email (placeholder - implement with your email service)
        async sendInvitationEmail(data) {
          // TODO: Implement email sending via Nodemailer/React Email
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
};

export const options = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};
