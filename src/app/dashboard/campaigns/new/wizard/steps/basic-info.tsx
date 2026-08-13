import * as React from "react";
import type { CampaignDraft } from "../page";

interface BasicInfoStepProps {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
}

export function BasicInfoStep({ draft, setDraft }: BasicInfoStepProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-slate-900">
          Campaign Details
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Give your campaign a name and description to help you identify it later.
        </p>
      </div>

      <div className="space-y-6">
        {/* Campaign Name */}
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">
            Campaign Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Q1 Outbound Sales Campaign"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            maxLength={200}
          />
          <p className="mt-1 text-xs text-slate-400">{draft.name.length}/200 characters</p>
        </div>

        {/* Info Box */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-6">
          <div className="flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100">
              <svg
                className="h-5 w-5 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-bold text-indigo-900">Pro Tip</h3>
              <p className="text-sm leading-relaxed text-indigo-900/70">
                Use descriptive names that include the target audience and goal. For example:
                "Enterprise SaaS - Product Demo Requests" or "Recruitment - Senior Engineers Q1
                2024".
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
