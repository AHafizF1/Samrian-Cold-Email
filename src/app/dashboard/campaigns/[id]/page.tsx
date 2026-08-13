"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ArrowLeft, Pause, CheckCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { CampaignAnalytics } from "@/components/campaigns/campaign-analytics";
import { ContactActivity } from "@/components/campaigns/contact-activity";
import { useApi } from "@/hooks/use-api";

interface CampaignDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  // Unwrap params Promise (Next.js 15+ requirement)
  const { id: campaignId } = React.use(params);

  const { data, refetch } = useApi<{ campaign: any | null }>(`/api/campaigns/${campaignId}`);
  const campaign = data?.campaign;

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = React.useState(false);

  const isLoading = data === undefined;

  // Reusable status update handler (DRY - single source of truth)
  const handleStatusChange = async (newStatus: string, actionLabel: string) => {
    setIsUpdating(true);
    try {
      await requestJson(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      refetch();
      toast.success(`Campaign ${actionLabel.toLowerCase()} successfully`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Failed to ${actionLabel.toLowerCase()} campaign`
      );
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
        <PageHeader
          title="Loading..."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Campaigns", href: "/dashboard/campaigns" },
            { label: "..." },
          ]}
        />
        <div className="mx-auto w-full max-w-7xl p-10">
          <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
        <PageHeader
          title="Campaign Not Found"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Campaigns", href: "/dashboard/campaigns" },
            { label: "Not Found" },
          ]}
        />
        <div className="mx-auto w-full max-w-7xl p-10">
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-24">
            <h3 className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
              Campaign not found
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              This campaign may have been deleted or you don't have access to it.
            </p>
            <Link
              href="/dashboard/campaigns"
              className="mt-8 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Campaigns
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
      <PageHeader
        title={campaign.name}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Campaigns", href: "/dashboard/campaigns" },
          { label: campaign.name },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {campaign.status === "active" && (
              <button
                onClick={() => handleStatusChange("paused", "Paused")}
                disabled={isUpdating}
                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-600 shadow-sm transition-colors hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Pause className="h-4 w-4" />
                {isUpdating ? "Pausing..." : "Pause Campaign"}
              </button>
            )}
            {(campaign.status === "active" || campaign.status === "paused") && (
              <button
                onClick={() => setShowCompleteConfirm(true)}
                disabled={isUpdating}
                className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition-colors hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="h-4 w-4" />
                Mark Complete
              </button>
            )}
            <Link
              href="/dashboard/campaigns"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-7xl p-10">
        {/* Campaign Info Card */}
        <div className="mb-8 rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-indigo-900">
            Campaign Configuration
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{campaign.status}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Timezone</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {campaign.schedule.defaultTimezone}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Send Window
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {campaign.schedule.startTime} - {campaign.schedule.endTime}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Days Allowed
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {campaign.schedule.daysAllowed.join(", ")}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Send className="h-5 w-5 text-indigo-600" />
            <h3 className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-indigo-900">
              Sending Mailboxes
            </h3>
          </div>
          {(campaign.mailboxIds?.length ?? 0) === 0 ? (
            <p className="text-sm text-amber-700">No sending mailboxes linked.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {campaign.mailboxIds.map((mailboxId: string) => (
                <span
                  key={mailboxId}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  {mailboxId}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Analytics Dashboard */}
        <div className="mb-8">
          <CampaignAnalytics campaignId={campaignId} />
        </div>

        {/* Contact Activity */}
        <ContactActivity campaignId={campaignId} />
      </div>

      {/* Complete Confirmation Modal */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
              Mark Campaign Complete?
            </h3>
            <p className="mb-6 text-sm text-slate-600">
              This will stop all scheduled emails and mark the campaign as completed. This action
              cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCompleteConfirm(false)}
                disabled={isUpdating}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleStatusChange("completed", "Completed");
                  setShowCompleteConfirm(false);
                }}
                disabled={isUpdating}
                className="rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? "Completing..." : "Mark Complete"}
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
}
