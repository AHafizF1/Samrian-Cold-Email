"use client";

import * as React from "react";

import { ApiKeys } from "@/components/api-keys";
import { MembersRoles } from "@/components/members-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type ComplianceSettings = {
  listUnsubscribeEnabled: boolean;
  physicalAddress?: string | null;
  defaultSenderName?: string | null;
  unsubscribeFooter?: string | null;
  unsubscribeMailto?: string | null;
  bouncePauseRate: number;
  unsubscribePauseRate: number;
  complaintPauseRate: number;
};

type DomainReadiness = {
  status: "pass" | "warn" | "unknown";
  issues: string[];
  warnings: string[];
  cached: boolean;
};

type NotificationPrefs = {
  replyInAppEnabled: boolean;
  replyForwardEnabled: boolean;
  replyForwardEmails: string[];
  browserPushEnabled: boolean;
};

type SendingSettings = {
  defaultRampEnabled: boolean;
  defaultRampTarget: number;
  replyReserve: number;
};

const fallbackSettings: ComplianceSettings = {
  listUnsubscribeEnabled: false,
  bouncePauseRate: 0.05,
  unsubscribePauseRate: 0.1,
  complaintPauseRate: 0.001,
};

const fallbackNotificationPrefs: NotificationPrefs = {
  replyInAppEnabled: true,
  replyForwardEnabled: false,
  replyForwardEmails: [],
  browserPushEnabled: false,
};

const fallbackSendingSettings: SendingSettings = {
  defaultRampEnabled: false,
  defaultRampTarget: 30,
  replyReserve: 2,
};

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<ComplianceSettings>(fallbackSettings);
  const [status, setStatus] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [readiness, setReadiness] = React.useState<DomainReadiness | null>(null);
  const [domainStatus, setDomainStatus] = React.useState("");
  const [notificationPrefs, setNotificationPrefs] =
    React.useState<NotificationPrefs>(fallbackNotificationPrefs);
  const [notificationStatus, setNotificationStatus] = React.useState("");
  const [sending, setSending] = React.useState<SendingSettings>(fallbackSendingSettings);
  const [sendingStatus, setSendingStatus] = React.useState("");

  React.useEffect(() => {
    fetch("/api/settings/compliance")
      .then((response) => response.json())
      .then((data) => setSettings({ ...fallbackSettings, ...data }))
      .catch(() => setStatus("Could not load settings"));

    fetch("/api/settings/notifications")
      .then((response) => response.json())
      .then((data) => setNotificationPrefs({ ...fallbackNotificationPrefs, ...data }))
      .catch(() => setNotificationStatus("Could not load notification settings"));

    fetch("/api/settings/sending")
      .then((response) => response.json())
      .then((data) => setSending({ ...fallbackSendingSettings, ...data }))
      .catch(() => setSendingStatus("Could not load sending settings"));
  }, []);

  async function save() {
    setStatus("Saving...");
    const response = await fetch("/api/settings/compliance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      setStatus("Could not save settings");
      return;
    }
    setSettings({ ...fallbackSettings, ...(await response.json()) });
    setStatus("Saved");
  }

  async function checkDomain() {
    if (!domain.trim()) return;
    setDomainStatus("Checking...");
    const response = await fetch(`/api/domains/check?domain=${encodeURIComponent(domain.trim())}`);
    if (!response.ok) {
      setDomainStatus("Could not check domain");
      return;
    }
    setReadiness(await response.json());
    setDomainStatus("");
  }

  async function saveNotificationPrefs() {
    setNotificationStatus("Saving...");
    const response = await fetch("/api/settings/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notificationPrefs),
    });
    if (!response.ok) {
      setNotificationStatus("Could not save notification settings");
      return;
    }
    setNotificationPrefs({ ...fallbackNotificationPrefs, ...(await response.json()) });
    setNotificationStatus("Saved");
  }

  async function saveSending() {
    setSendingStatus("Saving...");
    const response = await fetch("/api/settings/sending", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sending),
    });
    if (!response.ok) {
      setSendingStatus("Could not save sending settings");
      return;
    }
    setSending({ ...fallbackSendingSettings, ...(await response.json()) });
    setSendingStatus("Saved");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Compliance and deliverability controls.</p>
      </div>

      <section className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-medium text-slate-950">One-click unsubscribe</h2>
            <p className="text-sm text-slate-600">
              Off by default for cold email. Enable for bulk or newsletter-style campaigns.
            </p>
          </div>
          <Switch
            checked={settings.listUnsubscribeEnabled}
            onCheckedChange={(checked) =>
              setSettings((current) => ({ ...current, listUnsubscribeEnabled: checked }))
            }
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sender-name">Default sender name</Label>
            <Input
              id="sender-name"
              value={settings.defaultSenderName ?? ""}
              onChange={(event) =>
                setSettings((current) => ({ ...current, defaultSenderName: event.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mailto">Unsubscribe mailto</Label>
            <Input
              id="mailto"
              value={settings.unsubscribeMailto ?? ""}
              onChange={(event) =>
                setSettings((current) => ({ ...current, unsubscribeMailto: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="address">Physical mailing address</Label>
          <Textarea
            id="address"
            value={settings.physicalAddress ?? ""}
            onChange={(event) =>
              setSettings((current) => ({ ...current, physicalAddress: event.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="footer">Unsubscribe footer</Label>
          <Textarea
            id="footer"
            value={settings.unsubscribeFooter ?? ""}
            onChange={(event) =>
              setSettings((current) => ({ ...current, unsubscribeFooter: event.target.value }))
            }
            placeholder="Unsubscribe: {{unsubscribeUrl}}"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bounce-rate">Bounce pause rate</Label>
            <Input
              id="bounce-rate"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={settings.bouncePauseRate}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  bouncePauseRate: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="unsubscribe-rate">Unsubscribe pause rate</Label>
            <Input
              id="unsubscribe-rate"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={settings.unsubscribePauseRate}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  unsubscribePauseRate: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="complaint-rate">Complaint pause rate</Label>
            <Input
              id="complaint-rate"
              type="number"
              step="0.001"
              min="0"
              max="1"
              value={settings.complaintPauseRate}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  complaintPauseRate: Number(event.target.value),
                }))
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">{status}</p>
          <Button onClick={save}>Save</Button>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-base font-medium text-slate-950">Mailbox ramp</h2>
          <p className="text-sm text-slate-600">
            Gradually raises real campaign volume. It does not send synthetic warmup messages.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="default-ramp">Enable for new mailboxes</Label>
            <p className="text-sm text-slate-600">
              Starts new mailboxes at a conservative five campaign sends per day.
            </p>
          </div>
          <Switch
            id="default-ramp"
            checked={sending.defaultRampEnabled}
            onCheckedChange={(checked) =>
              setSending((current) => ({ ...current, defaultRampEnabled: checked }))
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ramp-target">Default target per day</Label>
            <Input
              id="ramp-target"
              type="number"
              min="5"
              max="100"
              value={sending.defaultRampTarget}
              onChange={(event) =>
                setSending((current) => ({
                  ...current,
                  defaultRampTarget: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reply-reserve">Manual reply reserve</Label>
            <Input
              id="reply-reserve"
              type="number"
              min="0"
              max="10"
              value={sending.replyReserve}
              onChange={(event) =>
                setSending((current) => ({
                  ...current,
                  replyReserve: Number(event.target.value),
                }))
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">{sendingStatus}</p>
          <Button onClick={saveSending}>Save sending</Button>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-base font-medium text-slate-950">Reply notifications</h2>
          <p className="text-sm text-slate-600">
            Control how new inbox replies are surfaced. Browser push is stored as a preference only.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="reply-in-app">In-app reply notifications</Label>
            <p className="text-sm text-slate-600">Show new reply notifications in the header.</p>
          </div>
          <Switch
            id="reply-in-app"
            checked={notificationPrefs.replyInAppEnabled}
            onCheckedChange={(checked) =>
              setNotificationPrefs((current) => ({ ...current, replyInAppEnabled: checked }))
            }
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="reply-forward">Email forwarding</Label>
            <p className="text-sm text-slate-600">
              Forward new reply summaries to these addresses.
            </p>
          </div>
          <Switch
            id="reply-forward"
            checked={notificationPrefs.replyForwardEnabled}
            onCheckedChange={(checked) =>
              setNotificationPrefs((current) => ({ ...current, replyForwardEnabled: checked }))
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="forward-emails">Forwarding addresses</Label>
          <Textarea
            id="forward-emails"
            value={notificationPrefs.replyForwardEmails.join("\n")}
            onChange={(event) =>
              setNotificationPrefs((current) => ({
                ...current,
                replyForwardEmails: event.target.value
                  .split(/\r?\n|,/)
                  .map((item) => item.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="owner@example.com"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="browser-push">Browser push</Label>
            <p className="text-sm text-slate-600">
              Delivery adapter is deferred; preference is saved.
            </p>
          </div>
          <Switch
            id="browser-push"
            checked={notificationPrefs.browserPushEnabled}
            onCheckedChange={(checked) =>
              setNotificationPrefs((current) => ({ ...current, browserPushEnabled: checked }))
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">{notificationStatus}</p>
          <Button onClick={saveNotificationPrefs}>Save notifications</Button>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-base font-medium text-slate-950">Sender domain readiness</h2>
          <p className="text-sm text-slate-600">
            Checks are cached. Warnings do not block cold-email launches in this milestone.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="example.com"
          />
          <Button onClick={checkDomain}>Check</Button>
        </div>

        {domainStatus ? <p className="text-sm text-slate-600">{domainStatus}</p> : null}
        {readiness ? (
          <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
            <p className="font-medium text-slate-950">
              {readiness.status.toUpperCase()}
              {readiness.cached ? " cached" : ""}
            </p>
            {[...readiness.issues, ...readiness.warnings].length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {[...readiness.issues, ...readiness.warnings].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2">No DNS issues found.</p>
            )}
          </div>
        ) : null}
      </section>
      <MembersRoles />
      <ApiKeys />
    </div>
  );
}
