"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Check, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";

// Step components
import { BasicInfoStep } from "./steps/basic-info";
import { ScheduleStep } from "./steps/schedule";
import { EmailSequenceStep } from "./steps/email-sequence";
import { ContactAssignmentStep } from "./steps/contact-assignment";
import { MailboxesStep } from "./steps/mailboxes";
import { ReviewStep } from "./steps/review";

const STEPS = [
  { id: 1, name: "Basic Info", component: BasicInfoStep },
  { id: 2, name: "Schedule", component: ScheduleStep },
  { id: 3, name: "Email Sequence", component: EmailSequenceStep },
  { id: 4, name: "Assign Contacts", component: ContactAssignmentStep },
  { id: 5, name: "Select Mailboxes", component: MailboxesStep },
  { id: 6, name: "Review & Launch", component: ReviewStep },
] as const;

export type CampaignDraft = {
  id?: string;
  name: string;
  schedule: {
    defaultTimezone: string;
    daysAllowed: string[];
    startTime: string;
    endTime: string;
  };
  steps: Array<{ subject: string; body: string }>;
  targetGroupId?: string;
  targetContactIds?: string[];
  mailboxIds?: string[];
};

export default function CampaignWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");

  const [currentStep, setCurrentStep] = React.useState(1);
  const [isSaving, setIsSaving] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const [showLaunchConfirm, setShowLaunchConfirm] = React.useState(false);
  const [isLaunching, setIsLaunching] = React.useState(false);

  const { data: existingData } = useApi<{ campaign: any | null }>(
    draftId ? `/api/campaigns/${draftId}` : "/api/campaigns/__new__"
  );
  const existingDraft = draftId ? existingData?.campaign : null;

  // Campaign draft state
  const [draft, setDraft] = React.useState<CampaignDraft>({
    name: "",
    schedule: {
      defaultTimezone: "America/New_York",
      daysAllowed: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      startTime: "09:00",
      endTime: "17:00",
    },
    steps: [],
  });

  // Load existing draft data
  React.useEffect(() => {
    if (existingDraft) {
      setDraft({
        id: existingDraft._id ?? existingDraft.id,
        name: existingDraft.name,
        schedule: existingDraft.schedule,
        steps: existingDraft.steps,
        targetGroupId: existingDraft.targetGroupId,
        targetContactIds: existingDraft.targetContactIds,
        mailboxIds: existingDraft.mailboxIds,
      });
    }
  }, [existingDraft]);

  // Auto-save every 30 seconds
  React.useEffect(() => {
    if (!draft.name.trim()) return; // Don't save empty drafts

    const timer = setInterval(async () => {
      await handleSaveDraft();
    }, 30000);

    return () => clearInterval(timer);
  }, [draft]);

  const handleSaveDraft = async () => {
    if (!draft.name.trim()) return;

    setIsSaving(true);
    try {
      const result = await requestJson<{ id: string }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          id: draft.id,
          name: draft.name,
          schedule: draft.schedule,
          steps: draft.steps,
          targetGroupId: draft.targetGroupId,
          targetContactIds: draft.targetContactIds,
          mailboxIds: draft.mailboxIds,
        }),
      });
      const id = result.id;

      if (!draft.id) {
        setDraft((prev) => ({ ...prev, id }));
        // Update URL with draft ID
        router.replace(`/dashboard/campaigns/new/wizard?draft=${id}`);
      }

      setLastSaved(new Date());
    } catch (error: unknown) {
      console.error("Failed to save draft:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    // Save before moving to next step
    await handleSaveDraft();
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleLaunchClick = () => {
    if (!draft.id) {
      toast.error("Please save the campaign first");
      return;
    }
    setShowLaunchConfirm(true);
  };

  const handleLaunchConfirm = async () => {
    if (!draft.id) return;

    setIsLaunching(true);
    try {
      await handleSaveDraft();
      const result = await requestJson<{ status: string; assignmentCount: number }>(
        `/api/campaigns/${draft.id}/launch`,
        {
          method: "POST",
          body: JSON.stringify({ mailboxIds: draft.mailboxIds ?? [] }),
        }
      );
      const verb = result.status === "already-active" ? "already active" : "launched";
      toast.success(`Campaign ${verb} with ${result.assignmentCount} contacts`);
      router.push("/dashboard/campaigns");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to launch campaign");
    } finally {
      setIsLaunching(false);
      setShowLaunchConfirm(false);
    }
  };

  const CurrentStepComponent = STEPS[currentStep - 1].component;
  const isLastStep = currentStep === STEPS.length;
  const isFirstStep = currentStep === 1;

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
      <PageHeader
        title="Create Campaign"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Campaigns", href: "/dashboard/campaigns" },
          { label: "New Campaign" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && (
              <span className="text-xs text-slate-400">
                {isSaving ? "Saving..." : `Saved ${formatRelativeTime(lastSaved)}`}
              </span>
            )}
            <button
              onClick={handleSaveDraft}
              disabled={isSaving || !draft.name.trim()}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-7xl p-10">
        {/* Progress Indicator */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    disabled={step.id > currentStep}
                    className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold transition-all ${
                      step.id < currentStep
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : step.id === currentStep
                          ? "border-indigo-600 bg-white text-indigo-600 ring-4 ring-indigo-100"
                          : "border-slate-200 bg-white text-slate-400"
                    } ${step.id <= currentStep ? "cursor-pointer hover:scale-110" : "cursor-not-allowed"}`}
                  >
                    {step.id < currentStep ? <Check className="h-5 w-5" /> : step.id}
                  </button>
                  <span
                    className={`text-xs font-medium ${
                      step.id === currentStep ? "text-indigo-600" : "text-slate-400"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`mb-6 h-0.5 flex-1 ${
                      step.id < currentStep ? "bg-indigo-600" : "bg-slate-200"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-10 min-h-[500px]">
          <CurrentStepComponent draft={draft} setDraft={setDraft} />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-6">
          <button
            onClick={handleBack}
            disabled={isFirstStep}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {isLastStep ? (
            <button
              onClick={handleLaunchClick}
              disabled={!draft.id || isLaunching}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLaunching ? "Launching..." : "Launch Campaign"}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Launch Confirmation Modal */}
      {showLaunchConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
              Launch Campaign?
            </h3>
            <p className="mb-6 text-sm text-slate-600">
              This will activate your campaign and start sending emails based on the configured
              schedule. Make sure all settings are correct before proceeding.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowLaunchConfirm(false)}
                disabled={isLaunching}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLaunchConfirm}
                disabled={isLaunching}
                className="rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isLaunching ? "Launching..." : "Launch Campaign"}
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
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      issues?: string[];
    };
    throw new Error(body.issues?.join(". ") ?? body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
