"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, Reply, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useApi } from "@/hooks/use-api";

interface ContactActivityProps {
  campaignId: string;
}

export function ContactActivity({ campaignId }: ContactActivityProps) {
  const router = useRouter();
  const [cursor, setCursor] = React.useState<string | null>(null);

  const { data: result } = useApi<{
    page: any[];
    isDone: boolean;
    continueCursor: string | null;
  }>(`/api/campaigns/${campaignId}/assignments?limit=50`);

  if (result === undefined) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
          />
        ))}
      </div>
    );
  }

  const { page: assignments, isDone, continueCursor } = result;

  // Status configuration (DRY - single source of truth)
  const statusConfig: Record<
    string,
    { icon: React.ElementType; color: string; bgColor: string; label: string }
  > = {
    active: {
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      label: "In Progress",
    },
    replied: {
      icon: Reply,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      label: "Replied",
    },
    bounced: {
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      label: "Bounced",
    },
    completed: {
      icon: CheckCircle,
      color: "text-slate-600",
      bgColor: "bg-slate-50",
      label: "Completed",
    },
    unsubscribed: {
      icon: Mail,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      label: "Unsubscribed",
    },
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/50 p-6">
        <h3 className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-indigo-900">
          Contact Activity
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {assignments.length} contact{assignments.length !== 1 ? "s" : ""} in this campaign
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
            <Mail className="h-7 w-7 text-slate-400" />
          </div>
          <h4 className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-slate-900">
            No contacts assigned
          </h4>
          <p className="mt-2 text-sm text-slate-400">
            Add contacts to this campaign to start sending emails.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">Contact</th>
                  <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">Status</th>
                  <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">
                    Current Step
                  </th>
                  <th className="px-6 py-4 font-[family-name:var(--font-ibm-plex)]">Last Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {assignments.map((assignment: any) => {
                  const config = statusConfig[assignment.status] || statusConfig.active;
                  const StatusIcon = config.icon;

                  return (
                    <tr
                      key={assignment._id}
                      onClick={() => router.push(`/dashboard/contacts/${assignment.contactId}`)}
                      className="group cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-[family-name:var(--font-plus-jakarta)] text-sm font-bold text-indigo-600">
                            {assignment.contactId.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">Contact</p>
                            <p className="text-xs text-slate-500">{assignment.contactId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.bgColor} ${config.color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">Step {assignment.currentStep}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {assignment.lastEmailSentAt
                          ? new Date(assignment.lastEmailSentAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Not sent"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isDone && (
            <div className="flex items-center justify-center border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setCursor(continueCursor)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
