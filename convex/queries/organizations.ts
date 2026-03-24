import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireOrgAccess } from "../lib/auth";
import { authComponent, createAuth } from "../betterAuth/auth";

export const getActive = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const { orgId } = await requireOrgAccess(ctx);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const result = await auth.api.getFullOrganization({
      query: { organizationId: orgId },
      headers,
    });
    return result ?? null;
  },
});

export const listUserOrgs = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    await requireAuth(ctx);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const result = await auth.api.listOrganizations({ headers });
    return result ?? [];
  },
});
