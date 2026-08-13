"use client";

import * as React from "react";
import { Bell, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  readAt?: number;
  createdAt: number;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export function NotificationsBell() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<NotificationResponse>({
    notifications: [],
    unreadCount: 0,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=10");
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      setData((await response.json()) as NotificationResponse);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    await load();
  }

  async function openNotification(notification: NotificationItem) {
    if (!notification.readAt) await markRead(notification.id);
    const threadId =
      typeof notification.data?.threadId === "string" ? notification.data.threadId : undefined;
    if (notification.type === "reply" && threadId) {
      window.location.href = `/dashboard/inbox?thread=${encodeURIComponent(threadId)}`;
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    await load();
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) void load();
      }}
    >
      <DropdownMenuTrigger
        type="button"
        className="relative inline-flex size-8 items-center justify-center rounded-lg hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {data.unreadCount > 0 ? (
          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
            {data.unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
          <Button type="button" variant="ghost" size="sm" onClick={markAllRead}>
            <Check className="mr-1 h-4 w-4" />
            Mark all
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : data.notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No notifications</div>
          ) : (
            data.notifications.map((notification) => (
              <div key={notification.id} className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                    {notification.body ? (
                      <p className="mt-1 text-xs text-slate-500">{notification.body}</p>
                    ) : null}
                  </button>
                  {!notification.readAt ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => markRead(notification.id)}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
