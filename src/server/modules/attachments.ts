import type { AttachmentRef } from "../jobs/types";
import type { ConnectorFactory } from "../jobs/types";
import type { MailboxRepo, OrgId, ThreadRepo } from "../ports";

export const MAX_ATTACHMENT_BYTES = 4_000_000;

export type AttachmentBlockReason =
  "unsupported-provider" | "unsupported-type" | "type-mismatch" | "too-large" | "invalid-metadata";

export type AttachmentDecision =
  | { status: "allowed" }
  | { status: "blocked"; reason: AttachmentBlockReason }
  | { status: "open-provider"; providerUrl: string };

type AttachmentRepos = {
  threads: ThreadRepo;
  mailboxes: MailboxRepo;
};

type DownloadAttachmentDeps = {
  repos?: AttachmentRepos;
  connectorForMailbox: ConnectorFactory;
  transaction?: <T>(operation: (repos: AttachmentRepos) => Promise<T>) => Promise<T>;
};

export type AttachmentResult =
  | Exclude<AttachmentDecision, { status: "allowed" }>
  | {
      status: "allowed";
      body: ReadableStream<Uint8Array>;
      filename: string;
      size: number;
    };

const ALLOWED_TYPES: Record<string, readonly string[]> = {
  csv: ["text/csv", "application/csv", "text/plain"],
  doc: ["application/msword", "application/octet-stream"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ],
  jpeg: ["image/jpeg"],
  jpg: ["image/jpeg"],
  pdf: ["application/pdf", "application/octet-stream"],
  png: ["image/png"],
  txt: ["text/plain", "application/octet-stream"],
  webp: ["image/webp"],
  xls: ["application/vnd.ms-excel", "application/octet-stream"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
  ],
};

export function decideAttachment(input: {
  provider: string;
  attachment: AttachmentRef;
  providerUrl?: string;
  maxBytes?: number;
}): AttachmentDecision {
  if (input.provider !== "google" && input.provider !== "microsoft") {
    return { status: "blocked", reason: "unsupported-provider" };
  }
  const { attachment } = input;
  if (!attachment.id || !attachment.filename || attachment.size < 0) {
    return { status: "blocked", reason: "invalid-metadata" };
  }
  const extension = getExtension(attachment.filename);
  const allowedTypes = ALLOWED_TYPES[extension];
  if (!allowedTypes) return { status: "blocked", reason: "unsupported-type" };
  const contentType = attachment.contentType?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType && !allowedTypes.includes(contentType)) {
    return { status: "blocked", reason: "type-mismatch" };
  }
  if (attachment.size > (input.maxBytes ?? MAX_ATTACHMENT_BYTES)) {
    return isTrustedProviderUrl(input.provider, input.providerUrl)
      ? { status: "open-provider", providerUrl: input.providerUrl! }
      : { status: "blocked", reason: "too-large" };
  }
  return { status: "allowed" };
}

export async function downloadAttachment(
  input: { orgId: OrgId; threadId: string; attachmentId: string },
  deps: DownloadAttachmentDeps
): Promise<AttachmentResult> {
  const run =
    deps.transaction ??
    ((operation) => {
      if (!deps.repos) throw new Error("Attachment repositories are not configured");
      return operation(deps.repos);
    });
  const prepared = await run(async (repos) => {
    const thread = await repos.threads.getById(input.threadId, input.orgId);
    if (!thread || thread.direction !== "received") throw new Error("Thread not found");
    const attachment = thread.attachments?.find((item) => item.id === input.attachmentId);
    if (!attachment) throw new Error("Attachment not found");
    if (!thread.mailboxId) throw new Error("Mailbox not found");
    const mailbox = await repos.mailboxes.getById(thread.mailboxId, input.orgId);
    if (!mailbox) throw new Error("Mailbox not found");
    return { thread, attachment, mailbox };
  });

  const decision = decideAttachment({
    provider: prepared.mailbox.provider ?? "",
    attachment: prepared.attachment,
    providerUrl: prepared.thread.providerUrl,
  });
  if (decision.status !== "allowed") return decision;
  if (!prepared.thread.providerMessageId) {
    return { status: "blocked", reason: "invalid-metadata" };
  }

  const connector = await deps.connectorForMailbox(prepared.mailbox);
  try {
    if (!connector.getAttachment) {
      return { status: "blocked", reason: "unsupported-provider" };
    }
    const download = await connector.getAttachment(
      prepared.thread.providerMessageId,
      prepared.attachment.id
    );
    if (!download) throw new Error("Attachment not found");
    const actualDecision = decideAttachment({
      provider: prepared.mailbox.provider ?? "",
      attachment: { ...prepared.attachment, size: download.size },
      providerUrl: prepared.thread.providerUrl,
    });
    if (actualDecision.status !== "allowed") return actualDecision;
    return {
      status: "allowed",
      body: limitAttachmentStream(download.body, MAX_ATTACHMENT_BYTES),
      filename: sanitizeAttachmentName(prepared.attachment.filename),
      size: download.size,
    };
  } finally {
    await connector.close();
  }
}

export function sanitizeAttachmentName(value: string): string {
  const basename = value.replaceAll("\\", "/").split("/").at(-1) ?? "attachment";
  const safe = basename
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim()
    .slice(0, 180);
  return safe || "attachment";
}

export function limitAttachmentStream(
  source: ReadableStream<Uint8Array>,
  maxBytes: number
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let received = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const result = await reader.read();
      if (result.done) {
        controller.close();
        return;
      }
      received += result.value.byteLength;
      if (received > maxBytes) {
        await reader.cancel("Attachment exceeds download limit");
        controller.error(new Error("Attachment exceeds download limit"));
        return;
      }
      controller.enqueue(result.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function getExtension(filename: string): string {
  const name = filename.toLowerCase();
  const index = name.lastIndexOf(".");
  return index > -1 ? name.slice(index + 1) : "";
}

function isTrustedProviderUrl(provider: string, value?: string): value is string {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (provider === "google") {
      return hostname === "mail.google.com";
    }
    return hostname === "outlook.office.com" || hostname === "outlook.live.com";
  } catch {
    return false;
  }
}
