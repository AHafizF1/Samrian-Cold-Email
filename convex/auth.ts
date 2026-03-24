import { query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent, createAuth } from "./betterAuth/auth";

export const getCurrentUser = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => authComponent.getAuthUser(ctx),
});

export const getCurrentSession = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const result = await auth.api.getSession({ headers });
    return result?.session ?? null;
  },
});
