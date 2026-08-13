import { NextResponse } from "next/server";

import { getDb } from "@/server/db/db";
import { withTenant, withTrackingToken } from "@/server/db/tenant";
import { recordEvent } from "@/server/modules/events";
import { errorReporter } from "@/server/observability/runtime";
import { openEvent } from "@/server/modules/tracking";
import { PostgresEventRepo } from "@/server/repos";
import { withPublicLimit } from "@/server/limits/http";

const PIXEL = Buffer.from("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  return withPublicLimit(request, "tracking.open", () => track(context));
}

async function track({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const link = await withTrackingToken(db, token, (tx) =>
    new PostgresEventRepo(tx).getTrackedLink(token)
  );

  if (!link) return new NextResponse("Tracking pixel not found", { status: 404 });

  try {
    await withTenant(db, { orgId: link.orgId, actorType: "request" }, (tx) =>
      recordEvent(
        openEvent({
          orgId: link.orgId,
          campaignId: link.campaignId ?? undefined,
          contactId: link.contactId ?? undefined,
          assignmentId: link.assignmentId ?? undefined,
          threadId: link.threadId ?? undefined,
          messageId: link.messageId ?? undefined,
          token,
          occurredAt: Date.now(),
        }),
        { events: new PostgresEventRepo(tx) }
      )
    );
  } catch (error) {
    errorReporter.capture(error, { route: "/api/track/open/[token]", action: "track.open" });
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "image/gif",
    },
  });
}
