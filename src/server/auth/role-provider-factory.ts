import { headers } from "next/headers";

import { createBetterRoleProvider, createWorkosRoleProvider } from "./role-adapters";
import type { RoleProvider } from "./role-provider";
import { getAuthProviderName } from "./provider";

export async function getRoleProvider(requestHeaders?: Headers): Promise<RoleProvider> {
  if (getAuthProviderName() === "workos") {
    const { getWorkOS } = await import("@workos-inc/authkit-nextjs");
    return createWorkosRoleProvider(getWorkOS() as never);
  }

  const [{ getAuthDb }, { assertDatabaseRole }] = await Promise.all([
    import("../db/db"),
    import("../db/tenant"),
  ]);
  await assertDatabaseRole(getAuthDb(), "auth");

  const { createBetterAuth } = await import("./better");
  const auth = createBetterAuth();
  return createBetterRoleProvider(
    auth.api as unknown as Parameters<typeof createBetterRoleProvider>[0],
    requestHeaders ?? (await headers())
  );
}
