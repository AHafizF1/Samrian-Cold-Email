"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  ArrowLeft,
  Mail,
  Phone,
  Clock,
  Tag,
  Edit,
  Trash2,
  Send,
  Reply,
  ExternalLink,
  MailOpen,
} from "lucide-react";
import { useApi } from "@/hooks/use-api";

type CampaignHistoryAssignment = {
  _id: string;
  _creationTime: number;
  orgId: string;
  campaignId: string;
  contactId: string;
  status: string;
  currentStep: number;
  lastEmailSentAt?: number;
};

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const { data } = useApi<{
    contact: any | null;
    history: { page: CampaignHistoryAssignment[] };
  }>(`/api/contacts/${contactId}`);
  const contact = data?.contact;
  const campaignHistory = data?.history;

  const isLoading = data === undefined;

  if (isLoading) {
    return (
      <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
        <PageHeader
          title="Loading..."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Contacts", href: "/dashboard/contacts" },
            { label: "..." },
          ]}
        />
        <div className="mx-auto w-full max-w-7xl p-10">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
        <PageHeader
          title="Contact Not Found"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Contacts", href: "/dashboard/contacts" },
          ]}
        />
        <div className="mx-auto w-full max-w-7xl p-10">
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-24">
            <h3 className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
              Contact not found
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              This contact may have been deleted or you don't have access to it.
            </p>
            <Link
              href="/dashboard/contacts"
              className="mt-8 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Contacts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const contactName = contact.customVars?.name || "Unknown";
  const contactCompany = contact.customVars?.company || "No company";
  const contactPhone = contact.customVars?.phone || "Not provided";

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
      <PageHeader
        title={contactName}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Contacts", href: "/dashboard/contacts" },
          { label: contactName },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50">
              <Edit className="h-4 w-4" />
              Edit
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-7xl p-10">
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/dashboard/contacts"
              className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-indigo-600"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Contacts
            </Link>
            <h1 className="font-[family-name:var(--font-plus-jakarta)] text-4xl font-bold tracking-tight text-indigo-900">
              {contactName}
            </h1>
            <p className="mt-2 text-xl text-slate-600">{contactCompany}</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm transition-colors hover:bg-slate-50">
              <Send className="h-4 w-4" />
              Send Email
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95">
              Add to Campaign
            </button>
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          {/* Left Column: Contact Info */}
          <div className="space-y-8 md:col-span-4">
            {/* Contact Info Card */}
            <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-6 shadow-sm">
              <h3 className="font-[family-name:var(--font-plus-jakarta)] mb-6 text-lg font-bold text-indigo-900">
                Contact Info
              </h3>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <Mail className="mt-1 h-5 w-5 text-indigo-400" />
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase leading-none tracking-widest text-slate-400">
                      Email
                    </p>
                    <p className="text-sm font-medium text-indigo-900">{contact.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Phone className="mt-1 h-5 w-5 text-indigo-400" />
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase leading-none tracking-widest text-slate-400">
                      Phone
                    </p>
                    <p className="text-sm font-medium text-indigo-900">{contactPhone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Clock className="mt-1 h-5 w-5 text-indigo-400" />
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase leading-none tracking-widest text-slate-400">
                      Timezone
                    </p>
                    <p className="text-sm font-medium text-indigo-900">
                      {contact.timezone || "Not set"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="mt-8 border-t border-[rgba(199,196,216,0.4)] pt-8">
                <h4 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Status
                </h4>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ${
                    contact.bounceStatus === "hard"
                      ? "border border-red-100/50 bg-red-50 text-red-700"
                      : contact.bounceStatus === "soft"
                        ? "border border-amber-100/50 bg-amber-50 text-amber-700"
                        : "border border-emerald-100/50 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {contact.bounceStatus === "hard"
                    ? "Hard Bounce"
                    : contact.bounceStatus === "soft"
                      ? "Soft Bounce"
                      : "Active"}
                </span>
              </div>
            </div>

            {/* Custom Variables Card */}
            {contact.customVars && Object.keys(contact.customVars).length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[rgba(199,196,216,0.4)] bg-slate-50/50 p-6">
                  <h3 className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-indigo-900">
                    Custom Variables
                  </h3>
                  <Edit className="h-5 w-5 cursor-pointer text-slate-400 transition-colors hover:text-indigo-600" />
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {Object.entries(contact.customVars).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {key}
                        </span>
                        <span className="text-sm font-medium text-slate-900">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Activity Timeline */}
          <div className="overflow-hidden rounded-xl border border-[rgba(199,196,216,0.4)] bg-white p-8 shadow-sm md:col-span-8">
            <div className="mb-10 flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-indigo-900">
                Campaign History
              </h3>
              <div className="flex gap-2">
                <button className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-xs font-bold text-indigo-700">
                  All
                </button>
                <button className="rounded-lg px-4 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50">
                  Active
                </button>
                <button className="rounded-lg px-4 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50">
                  Completed
                </button>
              </div>
            </div>

            {/* Timeline */}
            {campaignHistory && campaignHistory.page.length > 0 ? (
              <div className="relative space-y-12">
                {/* Vertical Line */}
                <div className="absolute bottom-0 left-[15px] top-2 w-[2px] bg-[rgba(199,196,216,0.3)]"></div>

                {campaignHistory.page.map((assignment: CampaignHistoryAssignment, index: any) => (
                  <div key={assignment._id} className="relative pl-12">
                    <div
                      className={`absolute left-0 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                        assignment.status === "replied"
                          ? "border-emerald-500 bg-emerald-50"
                          : assignment.status === "bounced"
                            ? "border-red-500 bg-red-50"
                            : assignment.status === "active"
                              ? "border-indigo-400 bg-indigo-50"
                              : "border-slate-300 bg-white"
                      }`}
                    >
                      {assignment.status === "replied" ? (
                        <Reply className="h-4 w-4 text-emerald-600" />
                      ) : assignment.status === "bounced" ? (
                        <ExternalLink className="h-4 w-4 text-red-600" />
                      ) : assignment.status === "active" ? (
                        <MailOpen className="h-4 w-4 text-indigo-600" />
                      ) : (
                        <Send className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-bold text-indigo-900">
                          {assignment.status === "replied"
                            ? "Replied"
                            : assignment.status === "bounced"
                              ? "Bounced"
                              : assignment.status === "active"
                                ? "In Progress"
                                : assignment.status === "completed"
                                  ? "Completed"
                                  : "Assigned"}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          Campaign ID: {assignment.campaignId} • Step {assignment.currentStep}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-[11px] font-bold uppercase text-slate-400">
                        {assignment.lastEmailSentAt
                          ? new Date(assignment.lastEmailSentAt).toLocaleDateString()
                          : new Date(assignment._creationTime).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                  <Tag className="h-7 w-7 text-slate-400" />
                </div>
                <h4 className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-slate-900">
                  No campaign history
                </h4>
                <p className="mt-2 text-sm text-slate-400">
                  This contact hasn't been added to any campaigns yet.
                </p>
                <button className="mt-6 flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90">
                  Add to Campaign
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
