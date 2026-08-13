"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  TimePeriodSelector,
  getPeriodLabel,
  type TimePeriod,
} from "@/components/time-period-selector";
import { Send, Mail, Reply, TrendingUp, TrendingDown, AlertTriangle, WifiOff } from "lucide-react";
import { useApi } from "@/hooks/use-api";

function MetricCard({
  label,
  value,
  trend,
  trendValue,
  icon: Icon,
  sparklineData,
}: {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  sparklineData?: Array<{ date: string; value: number }>;
}) {
  // Generate SVG path from sparkline data - only use real data
  const generateSparklinePath = () => {
    if (!sparklineData || sparklineData.length === 0) {
      // Return flat line at bottom when no data
      return "M0 30 L100 30";
    }

    const maxValue = Math.max(...sparklineData.map((d) => d.value), 1);

    // If all values are 0, show flat line
    if (maxValue === 0) {
      return "M0 30 L100 30";
    }

    const points = sparklineData.map((d, i) => {
      const x = (i / (sparklineData.length - 1)) * 100;
      const y = 30 - (d.value / maxValue) * 25; // Scale to fit in 30px height
      return `${x} ${y}`;
    });

    return `M${points.join(" L")}`;
  };

  const sparklinePath = generateSparklinePath();
  const hasData = sparklineData && sparklineData.length > 0;

  return (
    <div className="group cursor-default rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-plus-jakarta)] text-sm font-semibold text-slate-900">
          {label}
        </h3>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <div className="mb-4 flex items-end gap-3">
        <span className="font-[family-name:var(--font-plus-jakarta)] text-3xl font-bold leading-none text-slate-900">
          {value}
        </span>
        {trend && trendValue && (
          <span
            className={`mb-0.5 flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ${
              trend === "up"
                ? "bg-emerald-50 text-emerald-600"
                : trend === "down"
                  ? "bg-red-50 text-red-600"
                  : "bg-amber-50 text-amber-600"
            }`}
          >
            {trend === "up" ? (
              <TrendingUp className="mr-0.5 h-3.5 w-3.5" />
            ) : trend === "down" ? (
              <TrendingDown className="mr-0.5 h-3.5 w-3.5" />
            ) : (
              <svg
                className="mr-0.5 h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
              </svg>
            )}
            {trendValue}
          </span>
        )}
      </div>
      {/* Sparkline */}
      <div className="mt-auto h-10 w-full">
        {!hasData ? (
          // Loading skeleton
          <div className="h-full w-full animate-pulse rounded bg-slate-100" />
        ) : (
          <svg
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 100 30"
          >
            <path
              d={sparklinePath}
              fill="none"
              stroke="#4F46E5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path
              d={`${sparklinePath} L100 30 L0 30 Z`}
              fill="url(#gradient-primary)"
              opacity="0.1"
            />
            <defs>
              <linearGradient id="gradient-primary" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [timePeriod, setTimePeriod] = React.useState<TimePeriod>("30");
  const days = parseInt(timePeriod);

  const { data: orgStats } = useApi<{
    totalSent: number;
    estimatedOpenRate: number | null;
    openTrackingEnabled: boolean;
    replyRate: number;
  }>("/api/analytics/org");
  const { data: campaignData } = useApi<{ campaigns: any[] }>("/api/campaigns");
  const { data: mailboxData } = useApi<{ mailboxes: any[] }>("/api/mailboxes");
  const recentActivity =
    campaignData?.campaigns
      ?.filter((campaign) => campaign.status === "active")
      .slice(0, 4)
      .map((campaign) => ({ ...campaign, emailsSent: 0, replyRate: 0 })) ?? [];
  const mailboxes = mailboxData?.mailboxes ?? [];

  const sentTrend = makeFlatTrend(days);
  const opensTrend = makeFlatTrend(days);
  const repliesTrend = makeFlatTrend(days);

  const sentComparison = { trend: "neutral" as const, percentChange: 0 };
  const estimatedOpenRateComparison = { trend: "neutral" as const, percentChange: 0 };
  const replyRateComparison = { trend: "neutral" as const, percentChange: 0 };

  const mailboxCount = mailboxes?.length ?? 0;
  const isLoading = orgStats === undefined || campaignData === undefined;

  // Helper to format trend text
  const formatTrendText = (comparison: typeof sentComparison): string => {
    if (!comparison || comparison.trend === "neutral") {
      return `Steady this ${getPeriodLabel(days)}`;
    }
    return `${comparison.percentChange.toFixed(1)}% from last ${getPeriodLabel(days)}`;
  };

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
      <PageHeader
        title="Overview"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Overview" }]}
        actions={<TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />}
      />

      <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
        {/* Metric Cards Grid */}
        {isLoading || !sentTrend || !opensTrend || !repliesTrend ? (
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
              />
            ))}
          </div>
        ) : (
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <MetricCard
              label="Total Sent"
              value={orgStats?.totalSent.toLocaleString() ?? "0"}
              trend={sentComparison?.trend ?? "neutral"}
              trendValue={formatTrendText(sentComparison)}
              icon={Send}
              sparklineData={sentTrend}
            />
            <MetricCard
              label="Open Rate"
              value={
                orgStats?.estimatedOpenRate == null
                  ? "Not tracked"
                  : `${orgStats.estimatedOpenRate.toFixed(1)}%`
              }
              trend={estimatedOpenRateComparison?.trend ?? "neutral"}
              trendValue={
                orgStats?.openTrackingEnabled
                  ? formatTrendText(estimatedOpenRateComparison)
                  : "Tracking off"
              }
              icon={Mail}
              sparklineData={opensTrend}
            />
            <MetricCard
              label="Reply Rate"
              value={`${orgStats?.replyRate.toFixed(1) ?? "0"}%`}
              trend={replyRateComparison?.trend ?? "neutral"}
              trendValue={formatTrendText(replyRateComparison)}
              icon={Reply}
              sparklineData={repliesTrend}
            />
          </div>
        )}

        {/* Split View: Campaigns & Health */}
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left: Active Campaigns Table */}
          <div className="flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h3 className="font-[family-name:var(--font-plus-jakarta)] font-semibold text-slate-900">
                Active Campaigns
              </h3>
              <Link
                href="/dashboard/campaigns"
                className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500"
              >
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-white text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-[family-name:var(--font-ibm-plex)]">
                      Campaign Name
                    </th>
                    <th className="px-5 py-3 font-[family-name:var(--font-ibm-plex)]">Status</th>
                    <th className="px-5 py-3 text-right font-[family-name:var(--font-ibm-plex)]">
                      Sent
                    </th>
                    <th className="px-5 py-3 text-right font-[family-name:var(--font-ibm-plex)]">
                      Reply Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8">
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                          Loading campaigns...
                        </div>
                      </td>
                    </tr>
                  ) : recentActivity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">
                        No active campaigns yet.{" "}
                        <Link
                          href="/dashboard/campaigns"
                          className="text-indigo-600 hover:text-indigo-500"
                        >
                          Create your first campaign
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    recentActivity.map((campaign: any) => (
                      <tr
                        key={campaign._id}
                        className="group cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 font-medium text-slate-900 transition-colors group-hover:text-indigo-600">
                          <Link href={`/dashboard/campaigns/${campaign._id}`}>{campaign.name}</Link>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Running
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-slate-600">
                          {campaign.emailsSent.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-slate-900">
                          {campaign.replyRate.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: System Health Widget */}
          <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:w-[320px]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="font-[family-name:var(--font-plus-jakarta)] font-semibold text-slate-900">
                System Health
              </h3>
              <svg
                className="h-5 w-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-4 p-5">
              {mailboxCount === 0 ? (
                <div className="flex gap-3 items-start rounded-md border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">No Mailboxes Connected</p>
                    <p className="mt-1 font-mono text-xs text-amber-700">
                      Connect a mailbox to start sending
                    </p>
                    <Link
                      href="/dashboard/mailboxes"
                      className="mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-600"
                    >
                      Connect Mailbox
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="my-1 h-px w-full bg-slate-200" />
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      <span className="text-sm font-medium text-slate-600">
                        {mailboxCount}/{mailboxCount} Mailboxes Active
                      </span>
                    </div>
                    <Link
                      href="/dashboard/mailboxes"
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Manage
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function makeFlatTrend(days: number) {
  return Array.from({ length: Math.max(days, 1) }, (_, index) => ({
    date: `${index + 1}`,
    value: 0,
  }));
}
