"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ExternalLink, Mail, Reply, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { InboxAttachments, type InboxAttachment } from "@/components/inbox/attachments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";

type InboxThread = {
  id: string;
  from?: string;
  sender?: InboxSender;
  subject: string;
  excerpt?: string;
  unread: boolean;
  receivedAt?: number;
};

type InboxMessage = {
  id: string;
  direction?: "sent" | "received";
  from?: string;
  sender?: InboxSender;
  to?: string[];
  subject: string;
  displayText?: string;
  attachments?: InboxAttachment[];
  links?: { url: string; hostname: string }[];
  sentAt?: number;
  receivedAt?: number;
};

type InboxSender = {
  address?: string;
  name?: string;
  suspicious: boolean;
};

type InboxResponse = {
  threads: InboxThread[];
  unreadCount: number;
};

type ThreadResponse = {
  thread: InboxThread;
  messages: InboxMessage[];
};

export default function InboxPage() {
  const searchParams = useSearchParams();
  const requestedThreadId = searchParams.get("thread") ?? undefined;
  const { data, refetch } = useApi<InboxResponse>("/api/inbox?limit=50");
  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const threadUrl = selectedId ? `/api/inbox/threads/${selectedId}` : "";
  const { data: threadData, refetch: refetchThread } = useApi<ThreadResponse>(threadUrl);

  const threads = data?.threads ?? [];
  const selectedThread = threadData?.thread;

  React.useEffect(() => {
    if (requestedThreadId && requestedThreadId !== selectedId) {
      setSelectedId(requestedThreadId);
      return;
    }
    if (!selectedId && threads[0]) setSelectedId(threads[0].id);
  }, [requestedThreadId, selectedId, threads]);

  async function markRead(id: string) {
    await fetch(`/api/inbox/threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    refetch();
    refetchThread();
  }

  async function sendReply() {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/inbox/threads/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: draft,
          clientRequestId: crypto.randomUUID(),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed: ${response.status}`);
      }
      setDraft("");
      refetchThread();
      refetch();
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Reply failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
      <PageHeader
        title="Inbox"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Inbox" }]}
        actions={
          <Button type="button" variant="outline" onClick={refetch}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid min-h-[calc(100vh-8rem)] grid-cols-[360px_1fr] border-t border-slate-200 bg-white">
        <aside className="border-r border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Replies</p>
              <p className="text-xs text-slate-500">{data?.unreadCount ?? 0} unread</p>
            </div>
          </div>
          <div className="max-h-[calc(100vh-13rem)] overflow-y-auto">
            {data === undefined ? (
              <div className="p-5 text-sm text-slate-500">Loading replies...</div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center text-sm text-slate-500">
                <Mail className="mb-3 h-8 w-8 text-slate-300" />
                No replies yet
              </div>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(thread.id);
                    if (thread.unread) void markRead(thread.id);
                  }}
                  className={`w-full border-b border-slate-100 px-5 py-4 text-left transition-colors hover:bg-slate-50 ${
                    selectedId === thread.id ? "bg-indigo-50" : "bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                      {thread.sender?.name ?? thread.sender?.address ?? "Unknown sender"}
                    </p>
                    {thread.unread ? (
                      <span className="mt-1 size-2 rounded-full bg-indigo-600" />
                    ) : null}
                  </div>
                  {thread.sender?.address ? (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {thread.sender.address}
                    </p>
                  ) : null}
                  <p className="mt-1 truncate text-sm text-slate-700">{thread.subject}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                    {thread.excerpt}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select a reply
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 px-6 py-4">
                <p className="text-lg font-semibold text-slate-900">
                  {selectedThread?.subject ?? "Conversation"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedThread?.sender?.name
                    ? `${selectedThread.sender.name} <${selectedThread.sender.address ?? "unknown"}>`
                    : (selectedThread?.sender?.address ?? "Unknown sender")}
                </p>
                {selectedThread?.sender?.suspicious ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Sender address uses a normalized or unusual domain. Verify before replying.
                  </p>
                ) : null}
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-6 py-6">
                {(threadData?.messages ?? []).map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-3xl rounded-lg border px-4 py-3 ${
                      message.direction === "sent"
                        ? "ml-auto border-indigo-100 bg-indigo-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-4 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {message.direction === "sent" ? "You" : (message.from ?? "Sender")}
                      </span>
                      <span>{formatTime(message.receivedAt ?? message.sentAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                      {message.displayText}
                    </p>
                    {message.links?.length ? (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <p className="mb-2 text-xs text-slate-500">
                          External links can report clicks. Verify destination before opening.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {message.links.map((link) => (
                            <a
                              key={link.url}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-full items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-950"
                              title={link.url}
                            >
                              <span className="truncate">{link.hostname}</span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <InboxAttachments threadId={message.id} attachments={message.attachments} />
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 bg-white p-4">
                {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-28 resize-none"
                />
                <div className="mt-3 flex justify-end">
                  <Button type="button" onClick={sendReply} disabled={sending || !draft.trim()}>
                    <Reply className="mr-2 h-4 w-4" />
                    {sending ? "Sending..." : "Send reply"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : "";
}
