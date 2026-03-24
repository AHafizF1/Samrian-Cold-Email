import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { ac, owner, admin, member } from "@/../lib/permissions";

export const authClient = createAuthClient({
  plugins: [
    convexClient(),
    organizationClient({
      ac,
      roles: { owner, admin, member },
    }),
  ],
});
