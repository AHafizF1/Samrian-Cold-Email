"use client";

import * as React from "react";
import { Users, Send, Reply, AlertTriangle } from "lucide-react";
import { useApi } from "@/hooks/use-api";

interface CampaignAnalyticsProps {
  campaignId: string;
}

export function CampaignAnalytics({ campaignId }: CampaignAnalyticsProps) {
  const { data: stats } = useApi<{
    totalContacts: number;
    emailsSent: number;
    replyRate: number;
    activeContacts: number;
    repliedContacts: number;
    bouncedContacts: number;
    completedContacts: number;
  }>(`/api/campaigns/${campaignId}/stats`);

  if (stats === undefined) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
      </div>
    );
  }

  // Calculate bounce rate
  const bounceRate = stats.emailsSent > 0 ? (stats.bouncedContacts / stats.emailsSent) * 100 : 0;

  // Stat cards configuration (DRY - single source of truth)
  const statCards = [
    {
      label: "Total Contacts",
      value: stats.totalContacts.toLocaleString(),
      icon: Users,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      label: "Emails Sent",
      value: stats.emailsSent.toLocaleString(),
      icon: Send,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Reply Rate",
      value: `${stats.replyRate.toFixed(1)}%`,
      icon: Reply,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Bounce Rate",
      value: `${bounceRate.toFixed(1)}%`,
      icon: AlertTriangle,
      color: bounceRate > 5 ? "text-red-600" : "text-amber-600",
      bgColor: bounceRate > 5 ? "bg-red-50" : "bg-amber-50",
    },
  ];

  // Status breakdown data (DRY - single source of truth)
  const statusData = [
    { label: "Active", count: stats.activeContacts, color: "bg-emerald-500" },
    { label: "Replied", count: stats.repliedContacts, color: "bg-blue-500" },
    { label: "Bounced", count: stats.bouncedContacts, color: "bg-red-500" },
    { label: "Completed", count: stats.completedContacts, color: "bg-slate-400" },
  ];

  const totalStatusCount = statusData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-8">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {card.label}
                </p>
                <p
                  className={`font-[family-name:var(--font-plus-jakarta)] text-3xl font-bold ${card.color}`}
                >
                  {card.value}
                </p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${card.bgColor}`}
              >
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Breakdown */}
      <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-6 shadow-sm">
        <h3 className="mb-6 font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-indigo-900">
          Contact Status Breakdown
        </h3>

        {totalStatusCount === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No contacts assigned yet</p>
        ) : (
          <div className="space-y-4">
            {/* Visual bar chart */}
            <div className="flex h-8 w-full overflow-hidden rounded-full bg-slate-100">
              {statusData.map((item) => {
                const percentage = (item.count / totalStatusCount) * 100;
                return percentage > 0 ? (
                  <div
                    key={item.label}
                    className={`${item.color} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                    title={`${item.label}: ${item.count} (${percentage.toFixed(1)}%)`}
                  />
                ) : null;
              })}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {statusData.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${item.color}`} />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-600">{item.label}</p>
                    <p className="text-sm font-bold text-slate-900">
                      {item.count.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
