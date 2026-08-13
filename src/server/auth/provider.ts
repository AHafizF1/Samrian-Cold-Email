import type { AuthProvider, AuthProviderName } from "./port";
import { getAuthProviderName as readAuthProviderName, requireWorkosConfig } from "./config";

export function getAuthProviderName(): AuthProviderName {
  return readAuthProviderName();
}

export function getAuthProvider(): AuthProvider {
  const provider = getAuthProviderName();

  if (provider === "workos") {
    requireWorkosConfig();
    return loadWorkosProvider();
  }

  return loadBetterAuthProvider();
}

function loadBetterAuthProvider(): AuthProvider {
  return {
    async getSession() {
      await assertBetterAuthRole();
      const { createBetterAuthProvider } = await import("./better");
      return createBetterAuthProvider().getSession();
    },
    async getActiveOrg() {
      await assertBetterAuthRole();
      const { createBetterAuthProvider } = await import("./better");
      return createBetterAuthProvider().getActiveOrg();
    },
    async hasPermission(permissions) {
      await assertBetterAuthRole();
      const { createBetterAuthProvider } = await import("./better");
      return createBetterAuthProvider().hasPermission(permissions);
    },
  };
}

async function assertBetterAuthRole() {
  const [{ getAuthDb }, { assertDatabaseRole }] = await Promise.all([
    import("../db/db"),
    import("../db/tenant"),
  ]);
  await assertDatabaseRole(getAuthDb(), "auth");
}

function loadWorkosProvider(): AuthProvider {
  return {
    async getSession() {
      const { createWorkosProvider } = await import("./workos");
      return createWorkosProvider().getSession();
    },
    async getActiveOrg() {
      const { createWorkosProvider } = await import("./workos");
      return createWorkosProvider().getActiveOrg();
    },
    async hasPermission(permissions) {
      const { createWorkosProvider } = await import("./workos");
      return createWorkosProvider().hasPermission(permissions);
    },
  };
}
