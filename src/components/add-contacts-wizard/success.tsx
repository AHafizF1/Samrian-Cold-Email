"use client";

import * as React from "react";
import { CheckCircle2, Users, Plus } from "lucide-react";
import Link from "next/link";

interface SuccessProps {
  contactCount: number;
  onClose: () => void;
}

export function Success({ contactCount, onClose }: SuccessProps) {
  return (
    <div className="p-12">
      <div className="mb-12 text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h1 className="mb-4 font-[family-name:var(--font-plus-jakarta)] text-4xl font-bold tracking-tight text-slate-900">
          Contacts Added Successfully!
        </h1>
        <p className="mx-auto max-w-2xl text-lg font-light text-slate-600">
          {contactCount} {contactCount === 1 ? "contact has" : "contacts have"} been added to your
          list
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href="/dashboard/campaigns/new"
          className="group flex flex-col items-center rounded-xl border-2 border-indigo-600 bg-indigo-50 p-8 text-center transition-all hover:shadow-xl"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h3 className="mb-2 font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-slate-900">
            Create Campaign
          </h3>
          <p className="text-sm text-slate-600">Start reaching out to your contacts</p>
        </Link>

        <button
          onClick={onClose}
          className="group flex flex-col items-center rounded-xl border-2 border-slate-200 bg-white p-8 text-center transition-all hover:border-indigo-300 hover:shadow-xl"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="mb-2 font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-slate-900">
            View Contacts
          </h3>
          <p className="text-sm text-slate-600">See your updated contact list</p>
        </button>

        <button
          onClick={onClose}
          className="group flex flex-col items-center rounded-xl border-2 border-slate-200 bg-white p-8 text-center transition-all hover:border-indigo-300 hover:shadow-xl"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="mb-2 font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-slate-900">
            Add More Contacts
          </h3>
          <p className="text-sm text-slate-600">Import another batch</p>
        </button>
      </div>

      {/* Footer */}
      <div className="flex justify-center border-t border-slate-200 pt-8">
        <button
          onClick={onClose}
          className="rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-12 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
        >
          Close
        </button>
      </div>
    </div>
  );
}
