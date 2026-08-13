"use client";

import * as React from "react";
import { Upload, Edit, Clipboard } from "lucide-react";
import type { ImportMethod } from "./index";
import {
  StepHeader,
  WizardFooter,
  WizardContainer,
  CheckmarkIcon,
  SecurityShieldIcon,
} from "./shared";

interface MethodSelectionProps {
  onSelect: (method: ImportMethod) => void;
  onCancel: () => void;
}

export function MethodSelection({ onSelect, onCancel }: MethodSelectionProps) {
  const [selected, setSelected] = React.useState<ImportMethod>(null);

  const methods = [
    {
      id: "csv" as const,
      icon: Upload,
      title: "Upload CSV",
      description: "Import from a spreadsheet",
      badge: "Most Popular",
    },
    {
      id: "manual" as const,
      icon: Edit,
      title: "Manual Entry",
      description: "Add individual contacts one by one",
    },
    {
      id: "paste" as const,
      icon: Clipboard,
      title: "Paste Data",
      description: "Copy and paste from Excel or Google Sheets",
    },
  ];

  return (
    <WizardContainer>
      <StepHeader
        stepNumber={1}
        stepLabel="Method Selection"
        title="Add Contacts"
        description="Choose how you want to bring your prospects into your list"
      />

      {/* Method Cards */}
      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {methods.map((method) => {
          const Icon = method.icon;
          const isSelected = selected === method.id;

          return (
            <button
              key={method.id}
              onClick={() => setSelected(method.id)}
              className={`group relative flex flex-col items-start rounded-xl border-2 p-8 text-left transition-all duration-300 hover:shadow-xl ${
                isSelected
                  ? "border-indigo-600 bg-indigo-50/50"
                  : "border-slate-200 bg-white hover:border-indigo-300"
              }`}
            >
              {method.badge && (
                <div className="absolute right-4 top-4 rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  {method.badge}
                </div>
              )}

              <div
                className={`mb-6 flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
                  isSelected
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-indigo-600 group-hover:bg-indigo-100"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>

              <h3 className="mb-2 font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
                {method.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">{method.description}</p>

              {isSelected && (
                <div className="mt-6 flex items-center text-xs font-semibold uppercase tracking-widest text-indigo-600">
                  Selected
                  <CheckmarkIcon />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <WizardFooter
        onCancel={onCancel}
        onNext={() => selected && onSelect(selected)}
        nextLabel="Continue"
        nextDisabled={!selected}
        showBackButton={false}
        leftContent={
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <SecurityShieldIcon />
            <span>All data is encrypted and processed according to GDPR guidelines</span>
          </div>
        }
      />
    </WizardContainer>
  );
}
