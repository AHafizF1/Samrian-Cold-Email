"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

export type TimePeriod = "7" | "30" | "90";

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

const periodLabels: Record<TimePeriod, string> = {
  "7": "Last 7 Days",
  "30": "Last 30 Days",
  "90": "Last 90 Days",
};

export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
      >
        <span>{periodLabels[value]}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {(Object.keys(periodLabels) as TimePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => {
                  onChange(period);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                  value === period ? "bg-indigo-50 font-medium text-indigo-600" : "text-slate-600"
                }`}
              >
                {periodLabels[period]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function getPeriodLabel(days: number): string {
  if (days === 7) return "week";
  if (days === 30) return "month";
  if (days === 90) return "quarter";
  return "period";
}
