import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Better Auth tables - using manual definition since the component export is not working
export default defineSchema({
  user: defineTable({
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.string(),
    image: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
    twoFactorEnabled: v.optional(v.union(v.null(), v.boolean())),
    isAnonymous: v.optional(v.union(v.null(), v.boolean())),
    username: v.optional(v.union(v.null(), v.string())),
    displayUsername: v.optional(v.union(v.null(), v.string())),
    phoneNumber: v.optional(v.union(v.null(), v.string())),
    phoneNumberVerified: v.optional(v.union(v.null(), v.boolean())),
    userId: v.optional(v.union(v.null(), v.string())),
  })
    .index("email_name", ["email", "name"])
    .index("name", ["name"])
    .index("userId", ["userId"])
    .index("username", ["username"])
    .index("phoneNumber", ["phoneNumber"]),

  session: defineTable({
    userId: v.string(),
    expiresAt: v.number(),
    token: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ipAddress: v.optional(v.union(v.null(), v.string())),
    userAgent: v.optional(v.union(v.null(), v.string())),
    // Required for organization plugin
    activeOrganizationId: v.optional(v.union(v.null(), v.string())),
  })
    .index("expiresAt", ["expiresAt"])
    .index("expiresAt_userId", ["expiresAt", "userId"])
    .index("token", ["token"])
    .index("userId", ["userId"]),

  account: defineTable({
    accountId: v.string(),
    providerId: v.string(),
    userId: v.string(),
    accessToken: v.optional(v.union(v.null(), v.string())),
    refreshToken: v.optional(v.union(v.null(), v.string())),
    idToken: v.optional(v.union(v.null(), v.string())),
    accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    scope: v.optional(v.union(v.null(), v.string())),
    password: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("accountId", ["accountId"])
    .index("accountId_providerId", ["accountId", "providerId"])
    .index("providerId_userId", ["providerId", "userId"])
    .index("userId", ["userId"]),

  verification: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("expiresAt", ["expiresAt"])
    .index("identifier", ["identifier"]),

  // Organization tables for multi-tenancy
  organization: defineTable({
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index("slug", ["slug"]),

  member: defineTable({
    organizationId: v.string(),
    userId: v.string(),
    role: v.string(),
    createdAt: v.number(),
  })
    .index("organizationId", ["organizationId"])
    .index("userId", ["userId"])
    .index("organizationId_userId", ["organizationId", "userId"]),

  invitation: defineTable({
    organizationId: v.string(),
    email: v.string(),
    role: v.string(),
    status: v.string(),
    expiresAt: v.number(),
    inviterId: v.string(),
  })
    .index("organizationId", ["organizationId"])
    .index("email", ["email"]),
});
