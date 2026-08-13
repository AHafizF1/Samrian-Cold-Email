import { handler } from "@/lib/auth-server";
import { withPublicLimit } from "@/server/limits/http";

export const GET = (request: Request) =>
  withPublicLimit(request, "auth.session", handler.GET, { penalizeStatuses: [401, 403] });
export const POST = (request: Request) =>
  withPublicLimit(request, "auth.sign-in", handler.POST, {
    penalizeStatuses: [400, 401, 403],
  });
