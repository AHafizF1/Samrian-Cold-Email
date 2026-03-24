import { QueryCtx, MutationCtx } from "../_generated/server";
import { authComponent, createAuth } from "../betterAuth/auth";

type Ctx = QueryCtx | MutationCtx;

export async function requireAuth(ctx: Ctx) {
  const user = await authComponent.getAuthUser(ctx);
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireOrgAccess(ctx: Ctx, permissions?: { [resource: string]: string[] }) {
  const user = await requireAuth(ctx);

  // Use Better Auth API to get session with active org
  const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
  const session = await auth.api.getSession({ headers });

  const orgId = session?.session?.activeOrganizationId;
  if (!orgId) throw new Error("No active organization");

  if (permissions) {
    // Use Better Auth API to check permissions
    const hasPermission = await auth.api.hasPermission({
      body: { permissions },
      headers,
    });

    if (!hasPermission) {
      throw new Error(`Missing permissions: ${JSON.stringify(permissions)}`);
    }
  }

  return { user, orgId };
}

/**
 * Verifies that a resource belongs to the user's organization.
 * Throws "Resource not found" error if the resource doesn't exist or doesn't belong to the org.
 * This provides a consistent security pattern across all mutations.
 */
export async function verifyOrgOwnership<T extends { orgId: string } | null>(
  resource: T,
  orgId: string,
  resourceName: string = "Resource"
): Promise<Exclude<T, null>> {
  if (!resource) {
    throw new Error(`${resourceName} not found`);
  }

  if (resource.orgId !== orgId) {
    throw new Error(`${resourceName} not found`);
  }

  return resource as Exclude<T, null>;
}

/**
 * Cascade deletes all campaign-contact assignments for a given campaign or contact.
 * Used when deleting campaigns or contacts to maintain referential integrity.
 */
export async function cascadeDeleteAssignments(
  ctx: MutationCtx,
  type: "campaign" | "contact",
  id: string
): Promise<void> {
  const indexName = type === "campaign" ? "by_campaign" : "by_contact";
  const fieldName = type === "campaign" ? "campaignId" : "contactId";

  const assignments = await ctx.db
    .query("campaignContacts")
    .withIndex(indexName, (q) => q.eq(fieldName as any, id as any))
    .collect();

  for (const assignment of assignments) {
    await ctx.db.delete(assignment._id);
  }
}
