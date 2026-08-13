"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Plus, Search, X, MoreHorizontal, BarChart3, RefreshCw, FileText } from "lucide-react";
import { useApi } from "@/hooks/use-api";

type CampaignStatus = "all" | "active" | "draft" | "completed" | "paused";

export default function CampaignsPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<CampaignStatus>("all");

  const { data: campaignData } = useApi<{ campaigns: any[] }>("/api/campaigns");
  const { data: orgStats } = useApi<{
    totalSent: number;
    estimatedOpenRate: number | null;
    replyRate: number;
  }>("/api/analytics/org");
  const campaigns = campaignData?.campaigns;

  const isLoading = campaigns === undefined;

  // Filter campaigns by status
  const filteredCampaigns = React.useMemo(() => {
    if (!campaigns) return [];

    let filtered = campaigns;

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((c: any) => c.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((c: any) => c.name.toLowerCase().includes(query));
    }

    return filtered;
  }, [campaigns, statusFilter, searchQuery]);

  // Calculate stats from backend
  const stats = {
    totalSent: orgStats?.totalSent ?? 0,
    avgOpenRate: orgStats?.estimatedOpenRate,
    avgReplyRate: orgStats?.replyRate ?? 0,
    activeCampaigns: campaigns?.filter((c: any) => c.status === "active").length ?? 0,
  };

  // Count campaigns by status
  const statusCounts = React.useMemo(() => {
    if (!campaigns) return { all: 0, active: 0, draft: 0, completed: 0, paused: 0 };

    return {
      all: campaigns.length,
      active: campaigns.filter((c: any) => c.status === "active").length,
      draft: campaigns.filter((c: any) => c.status === "draft").length,
      completed: campaigns.filter((c: any) => c.status === "completed").length,
      paused: campaigns.filter((c: any) => c.status === "paused").length,
    };
  }, [campaigns]);

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
      <PageHeader
        title="Campaigns"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Campaigns" }]}
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
                placeholder="Search campaigns..."
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
              href="/dashboard/campaigns/new"
              className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              New Campaign
            </Link>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-7xl p-10">
        {/* Header Section */}
        <div className="mb-10 flex flex-col gap-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="mb-1 text-sm font-medium text-slate-500">Overview</p>
              <h2 className="font-[family-name:var(--font-plus-jakarta)] text-3xl font-extrabold tracking-tight text-slate-900">
                Manage Outreach
              </h2>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex rounded-xl border border-[rgba(199,196,216,0.4)] bg-slate-100 p-1">
              {(["all", "active", "draft", "completed"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-6 py-2 text-sm font-semibold transition-all ${
                    statusFilter === status
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {status !== "all" && statusCounts[status] > 0 && (
                    <span className="ml-1.5 text-xs">({statusCounts[status]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Summary Cards */}
          <div className="grid grid-cols-4 gap-6">
            <StatCard
              label="Total Sent"
              value={stats.totalSent.toLocaleString()}
              showSteady={stats.totalSent === 0}
            />
            <StatCard
              label="Avg Open Rate"
              value={stats.avgOpenRate == null ? "Not tracked" : `${stats.avgOpenRate.toFixed(1)}%`}
              showSteady={stats.avgOpenRate == null}
            />
            <StatCard
              label="Avg Reply Rate"
              value={stats.avgReplyRate > 0 ? `${stats.avgReplyRate.toFixed(1)}%` : "—"}
              showSteady={stats.avgReplyRate === 0}
            />
            <StatCard
              label="Active Campaigns"
              value={stats.activeCampaigns.toString()}
              showSteady={stats.activeCampaigns === 0}
            />
          </div>
        </div>

        {/* Campaign Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
              />
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-24">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
              <BarChart3 className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
              {searchQuery || statusFilter !== "all" ? "No campaigns found" : "No campaigns yet"}
            </h3>
            <p className="mt-2 max-w-md text-center text-sm text-slate-400">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters or search query."
                : "Create your first campaign to start reaching out to your contacts."}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Link
                href="/dashboard/campaigns/new"
                className="mt-8 flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Start New Outreach
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {filteredCampaigns.map((campaign: any) => (
              <CampaignCard key={campaign._id} campaign={campaign} />
            ))}

            {/* Add New Placeholder */}
            <Link
              href="/dashboard/campaigns/new"
              className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 transition-all hover:border-indigo-400 hover:bg-white"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-transform group-hover:scale-110">
                <Plus className="h-5 w-5 text-slate-400 transition-colors group-hover:text-indigo-600" />
              </div>
              <span className="text-sm font-bold text-slate-500 group-hover:text-slate-900">
                Start New Outreach
              </span>
            </Link>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredCampaigns.length > 0 && (
          <div className="mt-16 flex items-center justify-between text-slate-400">
            <p className="text-[11px] font-medium">
              Viewing 1-{filteredCampaigns.length} of {statusCounts.all} Campaigns
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// REUSABLE COMPONENTS (Following DRY - extracted after 3+ uses)
// ============================================================

interface StatCardProps {
  label: string;
  value: string;
  showSteady?: boolean;
}

function StatCard({ label, value, showSteady }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-6 shadow-[0px_24px_48px_rgba(70,69,85,0.08)]">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <h4 className="mb-1 font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold leading-none text-slate-900">
        {value}
      </h4>
      {showSteady && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
          Steady
        </div>
      )}
    </div>
  );
}

interface CampaignCardProps {
  campaign: {
    _id: string;
    name: string;
    status: string;
    _creationTime: number;
  };
}

function CampaignCard({ campaign }: CampaignCardProps) {
  const statusConfig = getStatusConfig(campaign.status);

  // TODO: Fetch real metrics from backend
  const metrics = {
    sent: 0,
    estimatedOpenRate: null as number | null,
    replyRate: 0,
  };

  const lastUpdated = getRelativeTime(campaign._creationTime);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-[rgba(199,196,216,0.4)] bg-white shadow-[0px_24px_48px_rgba(70,69,85,0.08)] transition-all hover:border-indigo-400">
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900 transition-colors group-hover:text-indigo-600">
              {campaign.name}
            </h3>
            <span className="text-[10px] font-medium text-slate-400">
              Last updated: {lastUpdated}
            </span>
          </div>
          <StatusBadge status={campaign.status} config={statusConfig} />
        </div>

        {/* Metrics */}
        <div className="mb-6 grid grid-cols-3 gap-4 border-y border-slate-100 py-6">
          <MetricItem label="Sent" value={metrics.sent > 0 ? metrics.sent.toLocaleString() : "—"} />
          <MetricItem
            label="Open Rate"
            value={
              metrics.estimatedOpenRate == null
                ? "Not tracked"
                : `${metrics.estimatedOpenRate.toFixed(1)}%`
            }
            bordered
          />
          <MetricItem
            label="Reply Rate"
            value={metrics.replyRate > 0 ? `${metrics.replyRate.toFixed(1)}%` : "—"}
            bordered
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2">
            {/* TODO: Show team avatars */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg p-2 text-slate-400 transition-colors hover:text-indigo-600">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {campaign.status === "draft" ? (
              <Link
                href={`/dashboard/campaigns/${campaign._id}/edit`}
                className="flex items-center gap-1 rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
              >
                Resume Setup
              </Link>
            ) : campaign.status === "completed" ? (
              <div className="flex gap-2">
                <button className="flex items-center gap-1 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Duplicate
                </button>
                <Link
                  href={`/dashboard/campaigns/${campaign._id}`}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Full Report
                </Link>
              </div>
            ) : (
              <Link
                href={`/dashboard/campaigns/${campaign._id}`}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                View Analytics
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar (only for active campaigns) */}
      {campaign.status === "active" && (
        <div className="h-1 w-full overflow-hidden bg-slate-50">
          <div className="h-full w-3/4 bg-indigo-600" />
        </div>
      )}
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
  config: ReturnType<typeof getStatusConfig>;
}

function StatusBadge({ status, config }: StatusBadgeProps) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${config.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`} />
      {status}
    </span>
  );
}

interface MetricItemProps {
  label: string;
  value: string;
  bordered?: boolean;
}

function MetricItem({ label, value, bordered }: MetricItemProps) {
  return (
    <div className={`flex flex-col ${bordered ? "border-l border-slate-100 pl-4" : ""}`}>
      <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">
        {label}
      </span>
      <span className="font-[family-name:var(--font-plus-jakarta)] text-xl font-semibold tracking-tight text-slate-800">
        {value}
      </span>
    </div>
  );
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getStatusConfig(status: string) {
  const configs = {
    active: {
      className: "bg-emerald-50 text-emerald-600",
      dotClassName: "bg-emerald-500 animate-pulse",
    },
    draft: {
      className: "bg-slate-100 text-slate-500",
      dotClassName: "bg-slate-400",
    },
    completed: {
      className: "bg-indigo-50 text-indigo-600",
      dotClassName: "bg-indigo-500",
    },
    paused: {
      className: "bg-amber-50 text-amber-600",
      dotClassName: "bg-amber-500",
    },
  };

  return configs[status as keyof typeof configs] || configs.draft;
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
}
