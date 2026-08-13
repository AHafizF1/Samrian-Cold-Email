import { createSessionAction } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { getDb } from "@/server/db/db";
import { downloadAttachment } from "@/server/modules/attachments";
import { createPostgresJobRepos, createTenantConnectorFactory } from "@/server/repos";

export const GET = createSessionAction(
  sessionOperations.inboxRead,
  async (
    { orgId, userId, tenant },
    _request: Request,
    context: { params: Promise<{ id: string; attachmentId: string }> }
  ) => {
    const { id, attachmentId } = await context.params;
    try {
      const result = await downloadAttachment(
        { orgId, threadId: id, attachmentId },
        {
          transaction: (operation) =>
            tenant((db) => {
              const repos = createPostgresJobRepos(db);
              return operation({ threads: repos.threads, mailboxes: repos.mailboxes });
            }),
          connectorForMailbox: createTenantConnectorFactory(getDb(), {
            actorType: "request",
            userId,
          }),
        }
      );

      if (result.status === "blocked") {
        return Response.json(result, { status: result.reason === "too-large" ? 413 : 415 });
      }
      if (result.status === "open-provider") {
        return Response.json(result, { status: 409 });
      }
      return new Response(result.body, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": contentDisposition(result.filename),
          "Content-Length": String(result.size),
          "Content-Security-Policy": "sandbox",
          "Content-Type": "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Attachment download failed";
      return Response.json(
        { error: message.includes("not found") ? message : "Attachment download failed" },
        { status: message.includes("not found") ? 404 : 502 }
      );
    }
  },
  { operationId: "inbox.attachment.download" }
);

function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replaceAll('"', "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
