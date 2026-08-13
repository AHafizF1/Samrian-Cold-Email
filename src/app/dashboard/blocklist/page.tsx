"use client";

import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { Plus, ShieldOff, Trash2, AlertCircle } from "lucide-react";
import { useApi } from "@/hooks/use-api";

type ReasonFilter = "all" | "unsubscribed" | "bounced_hard" | "manual";

type DoNotContactEntry = {
  _id: string;
  _creationTime: number;
  orgId: string;
  email: string;
  reason: "unsubscribed" | "bounced_hard" | "manual";
  campaignId?: string;
  unsubscribeToken?: string;
  createdAt: number;
};

export default function BlocklistPage() {
  const [activeFilter, setActiveFilter] = React.useState<ReasonFilter>("all");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);

  const { data, refetch } = useApi<{ page: DoNotContactEntry[] }>("/api/blocklist");

  const isLoading = data === undefined;
  const entries: DoNotContactEntry[] = (data?.page ?? []) as DoNotContactEntry[];

  // Filter entries by reason
  const filteredEntries =
    activeFilter === "all" ? entries : entries.filter((entry) => entry.reason === activeFilter);

  // Calculate counts for filter tabs
  const counts = {
    all: entries.length,
    unsubscribed: entries.filter((e) => e.reason === "unsubscribed").length,
    bounced_hard: entries.filter((e) => e.reason === "bounced_hard").length,
    manual: entries.filter((e) => e.reason === "manual").length,
  };

  const handleAddEntry = async () => {
    if (!newEmail.trim()) return;

    setIsAdding(true);
    try {
      await requestJson("/api/blocklist", {
        method: "POST",
        body: JSON.stringify({ email: newEmail.trim(), reason: "manual" }),
      });
      setNewEmail("");
      setShowAddModal(false);
      refetch();
      alert("Email added to blocklist");
    } catch (error: unknown) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (!confirm(`Remove ${email} from blocklist?`)) return;

    try {
      await requestJson("/api/blocklist", {
        method: "DELETE",
        body: JSON.stringify({ email }),
      });
      refetch();
      alert("Removed from blocklist");
    } catch (error: unknown) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "unsubscribed":
        return "Unsubscribed";
      case "bounced_hard":
        return "Hard Bounced";
      case "manual":
        return "Manual";
      default:
        return reason;
    }
  };

  const getReasonBadgeColor = (reason: string) => {
    switch (reason) {
      case "unsubscribed":
        return "bg-amber-50 text-amber-600";
      case "bounced_hard":
        return "bg-red-50 text-red-600";
      case "manual":
        return "bg-slate-50 text-slate-600";
      default:
        return "bg-slate-50 text-slate-600";
    }
  };

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
      <PageHeader
        title="Blocklist"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Blocklist" }]}
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add to Blocklist
          </button>
        }
      />

      <div className="mx-auto w-full max-w-7xl p-10">
        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-4 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Total Blocked
            </p>
            <p className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-slate-900">
              {counts.all}
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-4 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Unsubscribed
            </p>
            <p className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-amber-600">
              {counts.unsubscribed}
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-4 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Hard Bounced
            </p>
            <p className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-red-600">
              {counts.bounced_hard}
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-4 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Manual Blocks
            </p>
            <p className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-slate-900">
              {counts.manual}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex items-center gap-2 border-b border-slate-200">
          {(["all", "unsubscribed", "bounced_hard", "manual"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                activeFilter === filter
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {filter === "all" ? "All" : getReasonLabel(filter)}
              <span className="ml-2 text-xs text-slate-400">({counts[filter]})</span>
            </button>
          ))}
        </div>

        {/* Blocklist Table */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
                />
              ))}
            </div>
          ) : filteredEntries.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-24">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                <ShieldOff className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
                {activeFilter === "all"
                  ? "No blocked emails"
                  : `No ${getReasonLabel(activeFilter).toLowerCase()} emails`}
              </h3>
              <p className="mt-2 max-w-md text-center text-sm text-slate-400">
                {activeFilter === "all"
                  ? "Emails added to the blocklist will appear here."
                  : `No emails have been blocked for this reason yet.`}
              </p>
              {activeFilter === "all" && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-8 flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add to Blocklist
                </button>
              )}
            </div>
          ) : (
            /* Blocklist Table */
            <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">Email</th>
                      <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">Reason</th>
                      <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">
                        Date Added
                      </th>
                      <th className="px-6 py-4 text-right font-[family-name:var(--font-ibm-plex)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {filteredEntries.map((entry) => (
                      <tr key={entry._id} className="group transition-colors hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 font-[family-name:var(--font-plus-jakarta)] text-sm font-bold text-red-600">
                              <AlertCircle className="h-5 w-5" />
                            </div>
                            <p className="font-mono text-slate-900">{entry.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getReasonBadgeColor(entry.reason)}`}
                          >
                            {getReasonLabel(entry.reason)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleRemove(entry.email)}
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Remove from blocklist"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                <p className="text-xs font-medium tracking-tight text-slate-400">
                  Showing {filteredEntries.length} of {counts.all} blocked emails
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add to Blocklist Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
              Add to Blocklist
            </h3>
            <p className="mb-6 text-sm text-slate-600">
              Manually block an email address from receiving campaigns.
            </p>

            <div className="mb-6">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Email Address
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddEntry();
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewEmail("");
                }}
                disabled={isAdding}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEntry}
                disabled={isAdding || !newEmail.trim()}
                className="rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isAdding ? "Adding..." : "Add to Blocklist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return response.json();
}
