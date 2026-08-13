import { NextResponse } from "next/server";

import { createSessionAction } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresEventRepo } from "@/server/repos";
import type { DbTransaction } from "@/server/db/tx";
import { csvCell } from "@/server/modules/csv";

const MAX_EXPORT_DAYS = 90;

export const GET = createSessionAction(
  sessionOperations.analyticsExport,
  async ({ tenant, orgId }, request: Request) => {
    const { searchParams } = new URL(request.url);
    let range;
    try {
      range = readRange(searchParams);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid export range" },
        { status: 400 }
      );
    }
    const stream = eventStream(orgId, range, tenant);
    return new NextResponse(stream, {
      headers: {
        "Content-Disposition": "attachment; filename=analytics-events.csv",
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  },
  { operationId: "analytics.export", penalizeStatuses: [400] }
);

function readRange(params: URLSearchParams) {
  const from = params.get("from") ? new Date(params.get("from")!) : undefined;
  const to = params.get("to") ? new Date(params.get("to")!) : new Date();
  if (from && Number.isNaN(from.getTime())) throw new Error("Invalid from date");
  if (to && Number.isNaN(to.getTime())) throw new Error("Invalid to date");
  if (from && to && to.getTime() - from.getTime() > MAX_EXPORT_DAYS * 24 * 60 * 60 * 1000) {
    throw new Error("Analytics export range cannot exceed 90 days");
  }
  return { from, to };
}

function eventStream(
  orgId: string,
  range: ReturnType<typeof readRange>,
  tenant: <T>(operation: (db: DbTransaction) => Promise<T>) => Promise<T>
) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          "occurredAt,type,campaignId,contactId,mailboxId,assignmentId,threadId,messageId\n"
        )
      );
      let cursor: { occurredAt: Date; id: string } | undefined;
      let remaining = 50_000;
      try {
        while (remaining > 0) {
          const page = await tenant((db) =>
            new PostgresEventRepo(db).listEventPage({
              orgId,
              range,
              limit: Math.min(500, remaining),
              cursor,
            })
          );
          if (page.length === 0) break;
          const rows = page.map((event) =>
            [
              event.occurredAt.toISOString(),
              event.type,
              event.campaignId ?? "",
              event.contactId ?? "",
              event.mailboxId ?? "",
              event.assignmentId ?? "",
              event.threadId ?? "",
              event.messageId ?? "",
            ]
              .map(csvCell)
              .join(",")
          );
          controller.enqueue(encoder.encode(`${rows.join("\n")}\n`));
          remaining -= page.length;
          const last = page.at(-1);
          if (!last || page.length < 500) break;
          cursor = { occurredAt: last.occurredAt, id: last.id };
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
