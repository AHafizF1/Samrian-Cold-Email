import { toNextJsHandler } from "better-auth/next-js";

type BetterHandler = ReturnType<typeof toNextJsHandler>;

let betterHandler: Promise<BetterHandler> | undefined;

async function loadBetterHandler() {
  betterHandler ??= Promise.all([
    import("@/server/auth/auth"),
    import("@/server/db/db"),
    import("@/server/db/tenant"),
  ]).then(async ([{ auth }, { getAuthDb }, { assertDatabaseRole }]) => {
    await assertDatabaseRole(getAuthDb(), "auth");
    return toNextJsHandler(auth);
  });
  return betterHandler;
}

async function handle(method: "GET" | "POST", request: Request) {
  // WorkOS owns its session routes and must not initialize Better Auth or its
  // database pool. Keep this provider check before the lazy import.
  if (process.env.AUTH_PROVIDER === "workos") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return (await loadBetterHandler())[method](request);
}

export const handler = {
  GET: (request: Request) => handle("GET", request),
  POST: (request: Request) => handle("POST", request),
};
