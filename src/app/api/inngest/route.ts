import { serve } from "inngest/next";
import { inngest } from "../../../../inngest/client";
import { functions } from "../../../../inngest/functions/index";

const handlers = serve({
  client: inngest,
  functions,
});

function adapt(handler: typeof handlers.GET) {
  return (request: Request, context: unknown) =>
    handler(request as Parameters<typeof handler>[0], context);
}

export const GET = adapt(handlers.GET);
export const POST = adapt(handlers.POST);
export const PUT = adapt(handlers.PUT);
