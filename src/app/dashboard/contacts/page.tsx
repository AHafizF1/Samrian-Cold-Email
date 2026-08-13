"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  Plus,
  Users,
  Activity,
  Edit,
  Trash2,
  Search,
  X,
  Clock,
  CheckSquare,
  Square,
} from "lucide-react";
import { useApi } from "@/hooks/use-api";

type ContactItem = {
  _id: string;
  _creationTime: number;
  orgId: string;
  email: string;
  customVars: any;
  timezone?: string;
  bounceStatus?: string;
};

export default function ContactsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showTimezoneModal, setShowTimezoneModal] = React.useState(false);
  const [timezone, setTimezone] = React.useState("America/New_York");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Debounce search query (300ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isSearching = debouncedQuery.trim().length > 0;

  const contactsUrl = isSearching
    ? `/api/contacts?query=${encodeURIComponent(debouncedQuery.trim())}&limit=50`
    : "/api/contacts?limit=50";
  const { data, refetch } = useApi<{ contacts: ContactItem[] }>(contactsUrl);

  const isLoading = data === undefined;
  const contacts = data?.contacts ?? [];
  const totalContacts = contacts.length;

  // Calculate stats
  const contactsReached = 0;
  const avgHealthScore = 0;

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c._id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk operations
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} contact(s)? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await requestJson<{ success: string[]; errors: unknown[] }>("/api/contacts", {
        method: "DELETE",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (result.errors.length > 0) {
        alert(`Deleted ${result.success.length} contacts. ${result.errors.length} failed.`);
      } else {
        alert(`Successfully deleted ${result.success.length} contacts.`);
      }
      clearSelection();
      refetch();
    } catch (error: unknown) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkUpdateTimezone = async () => {
    setIsUpdating(true);
    try {
      const result = await requestJson<{ success: string[]; errors: unknown[] }>("/api/contacts", {
        method: "PATCH",
        body: JSON.stringify({ ids: Array.from(selectedIds), timezone }),
      });
      if (result.errors.length > 0) {
        alert(`Updated ${result.success.length} contacts. ${result.errors.length} failed.`);
      } else {
        alert(`Successfully updated ${result.success.length} contacts.`);
      }
      clearSelection();
      setShowTimezoneModal(false);
      refetch();
    } catch (error: unknown) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const allSelected = contacts.length > 0 && selectedIds.size === contacts.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < contacts.length;

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
      <PageHeader
        title="Contacts"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Contacts" }]}
        actions={
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by email..."
                className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Link
              href="/dashboard/contacts/import"
              className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add Contact
            </Link>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-7xl p-10">
        {/* Stats Cards - Horizontal */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Contacts Card */}
          <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-4 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Total Contacts
            </p>
            <p className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-slate-900">
              {totalContacts}
            </p>
          </div>

          {/* Contacts Reached Card */}
          <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-4 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Contacts Reached
            </p>
            <p className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-indigo-600">
              {contactsReached.toLocaleString()}
            </p>
          </div>

          {/* Avg Health Score Card */}
          <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-4 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Avg. Health Score
            </p>
            <p className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-slate-900">
              {avgHealthScore.toFixed(0)}%
            </p>
          </div>

          {/* Technical Insight Card */}
          <div className="relative overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
            <div className="relative z-10">
              <p className="mb-2 text-sm font-bold text-indigo-700">Technical Insight</p>
              <p className="text-xs leading-relaxed text-indigo-900/70">
                Contacts sync automatically with your campaigns.
              </p>
            </div>
            <Activity className="absolute -bottom-2 -right-2 h-16 w-16 text-indigo-200/50" />
          </div>
        </div>

        {/* Contacts List */}
        <div className="space-y-6">
          {/* Bulk Action Toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-6 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <CheckSquare className="h-5 w-5 text-indigo-600" />
                <span className="font-[family-name:var(--font-plus-jakarta)] text-sm font-bold text-indigo-900">
                  {selectedIds.size} contact{selectedIds.size !== 1 ? "s" : ""} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTimezoneModal(true)}
                  disabled={isUpdating}
                  className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-50"
                >
                  <Clock className="h-4 w-4" />
                  Assign Timezone
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
                <button
                  onClick={clearSelection}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
                />
              ))}
            </div>
          ) : totalContacts === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-24">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                {isSearching ? (
                  <Search className="h-7 w-7 text-slate-400" />
                ) : (
                  <Users className="h-7 w-7 text-slate-400" />
                )}
              </div>
              <h3 className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
                {isSearching ? "No results found" : "No contacts yet"}
              </h3>
              <p className="mt-2 max-w-md text-center text-sm text-slate-400">
                {isSearching
                  ? `No contacts found matching "${searchQuery}". Try a different search term.`
                  : "Add your first contact to start building your outreach list."}
              </p>
              {isSearching ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-8 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Clear Search
                </button>
              ) : (
                <Link
                  href="/dashboard/contacts/import"
                  className="mt-8 flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Contact
                </Link>
              )}
            </div>
          ) : (
            /* Contacts Table */
            <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">
                        <button
                          onClick={toggleSelectAll}
                          className="flex items-center text-slate-500 transition-colors hover:text-indigo-600"
                        >
                          {allSelected ? (
                            <CheckSquare className="h-5 w-5" />
                          ) : someSelected ? (
                            <div className="flex h-5 w-5 items-center justify-center rounded border-2 border-indigo-600 bg-indigo-50">
                              <div className="h-2 w-2 rounded-sm bg-indigo-600" />
                            </div>
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">Contact</th>
                      <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">Email</th>
                      <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">
                        Timezone
                      </th>
                      <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">Status</th>
                      <th className="px-6 py-4 text-right font-[family-name:var(--font-ibm-plex)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {contacts.map((contact) => {
                      const isSelected = selectedIds.has(contact._id);
                      return (
                        <tr
                          key={contact._id}
                          className={`group transition-colors hover:bg-slate-50 ${
                            isSelected ? "bg-indigo-50/50" : ""
                          }`}
                        >
                          <td className="px-6 py-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelect(contact._id);
                              }}
                              className="flex items-center text-slate-400 transition-colors hover:text-indigo-600"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-indigo-600" />
                              ) : (
                                <Square className="h-5 w-5" />
                              )}
                            </button>
                          </td>
                          <td
                            onClick={() => router.push(`/dashboard/contacts/${contact._id}`)}
                            className="cursor-pointer px-6 py-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-[family-name:var(--font-plus-jakarta)] text-sm font-bold text-indigo-600">
                                {contact.email.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">
                                  {contact.customVars?.name || "Unknown"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {contact.customVars?.company || "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td
                            onClick={() => router.push(`/dashboard/contacts/${contact._id}`)}
                            className="cursor-pointer px-6 py-4 font-mono text-slate-600"
                          >
                            {contact.email}
                          </td>
                          <td
                            onClick={() => router.push(`/dashboard/contacts/${contact._id}`)}
                            className="cursor-pointer px-6 py-4 text-slate-600"
                          >
                            {contact.timezone || "Not set"}
                          </td>
                          <td
                            onClick={() => router.push(`/dashboard/contacts/${contact._id}`)}
                            className="cursor-pointer px-6 py-4"
                          >
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                contact.bounceStatus === "hard"
                                  ? "bg-red-50 text-red-600"
                                  : contact.bounceStatus === "soft"
                                    ? "bg-amber-50 text-amber-600"
                                    : "bg-emerald-50 text-emerald-600"
                              }`}
                            >
                              {contact.bounceStatus || "Active"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Implement edit functionality
                                }}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600"
                                title="Edit Contact"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Implement delete functionality
                                }}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                <p className="text-xs font-medium tracking-tight text-slate-400">
                  {isSearching ? (
                    <>
                      Found {totalContacts} result{totalContacts !== 1 ? "s" : ""} for "
                      {searchQuery}"
                    </>
                  ) : (
                    <>
                      Showing 1 to {Math.min(totalContacts, 50)} of {totalContacts} contacts
                    </>
                  )}
                </p>
                {!isSearching && (
                  <div className="flex items-center gap-2">
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(199,196,216,0.4)] text-slate-400 transition-colors hover:text-indigo-600">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-[11px] font-bold text-indigo-600">
                      1
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold transition-colors hover:bg-slate-100">
                      2
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold transition-colors hover:bg-slate-100">
                      3
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(199,196,216,0.4)] text-slate-400 transition-colors hover:text-indigo-600">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timezone Assignment Modal */}
      {showTimezoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
              Assign Timezone
            </h3>
            <p className="mb-6 text-sm text-slate-600">
              Set timezone for {selectedIds.size} selected contact
              {selectedIds.size !== 1 ? "s" : ""}
            </p>

            <div className="mb-6">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                <option value="America/Denver">America/Denver (MST/MDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEDT/AEST)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowTimezoneModal(false)}
                disabled={isUpdating}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdateTimezone}
                disabled={isUpdating}
                className="rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isUpdating ? "Updating..." : "Assign Timezone"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
