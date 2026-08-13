"use client";

import * as React from "react";
import { Download, FileText, ShieldAlert } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

export type InboxAttachment = {
  id: string;
  filename: string;
  size: number;
  contentType?: string;
  inline: boolean;
};

const WARNING_KEY = "samrian:attachment-warning-accepted";

export function InboxAttachments({
  threadId,
  attachments,
}: {
  threadId: string;
  attachments?: InboxAttachment[];
}) {
  const [pending, setPending] = React.useState<InboxAttachment>();
  const [error, setError] = React.useState<string>();
  if (!attachments?.length) return null;

  async function requestDownload(attachment: InboxAttachment) {
    setError(undefined);
    if (sessionStorage.getItem(WARNING_KEY) !== "yes") {
      setPending(attachment);
      return;
    }
    await download(attachment);
  }

  async function download(attachment: InboxAttachment) {
    const response = await fetch(
      `/api/inbox/threads/${encodeURIComponent(threadId)}/attachments/${encodeURIComponent(attachment.id)}`
    );
    if (response.status === 409) {
      const result = (await response.json()) as { providerUrl?: string };
      if (result.providerUrl) window.open(result.providerUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        reason?: string;
      };
      setError(result.error ?? attachmentError(result.reason));
      return;
    }
    const blob = await response.blob();
    if (typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <p className="mb-2 text-xs font-medium text-slate-600">Attachments</p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <Button
            key={attachment.id}
            type="button"
            variant="outline"
            onClick={() => void requestDownload(attachment)}
            aria-label={`Download ${attachment.filename}`}
            className="h-auto max-w-full justify-start gap-2 px-3 py-2"
          >
            <FileText className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{attachment.filename}</span>
            <span className="shrink-0 text-xs text-slate-500">{formatBytes(attachment.size)}</span>
            <Download className="size-3.5 shrink-0" />
          </Button>
        ))}
      </div>
      {error ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-700">
          <ShieldAlert className="size-3.5" />
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        title="Download attachment?"
        description="Attachments can contain harmful content. Gmail or Outlook may have screened this file, but no screening guarantees safety. Download only if you trust the sender."
        confirmText="Download anyway"
        isOpen={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(undefined);
        }}
        onConfirm={() => {
          if (!pending) return;
          sessionStorage.setItem(WARNING_KEY, "yes");
          const attachment = pending;
          setPending(undefined);
          void download(attachment);
        }}
      />
    </div>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentError(reason?: string) {
  if (reason === "unsupported-type") return "This file type is not available for download.";
  if (reason === "too-large") return "This file exceeds Samrian's download limit.";
  return "Attachment download failed.";
}
