import { authkitProxy } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const workosProxy = authkitProxy({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      "/",
      "/sign-in",
      "/sign-up",
      "/api/auth/:path*",
      "/api/health",
      "/api/inngest",
      "/api/unsubscribe",
      "/api/track/:path*",
    ],
  },
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (process.env.AUTH_PROVIDER !== "workos") {
    return NextResponse.next();
  }

  return workosProxy(request, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
