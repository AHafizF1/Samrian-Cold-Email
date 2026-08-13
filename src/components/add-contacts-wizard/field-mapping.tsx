"use client";

import * as React from "react";
import type { ContactData } from "./index";
import { StepHeader, WizardFooter, WizardContainer } from "./shared";

interface FieldMappingProps {
  rawData: string[][];
  onNext: (fieldMapping: Record<string, string>, contacts: ContactData[]) => void;
  onBack: () => void;
  onCancel: () => void;
}

const FIELD_OPTIONS = [
  { value: "email", label: "Email", required: true },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "company", label: "Company" },
  { value: "jobTitle", label: "Job Title" },
  { value: "country", label: "Country" },
  { value: "industry", label: "Industry" },
  { value: "companySize", label: "Company Size" },
  { value: "timezone", label: "Timezone" },
  { value: "skip", label: "Skip this column" },
];

export function FieldMapping({ rawData, onNext, onBack, onCancel }: FieldMappingProps) {
  const headers = rawData[0] || [];
  const [mapping, setMapping] = React.useState<Record<string, string>>(() => {
    // Auto-map common fields
    const autoMapping: Record<string, string> = {};
    headers.forEach((header) => {
      const lower = header.toLowerCase();
      if (lower.includes("email")) autoMapping[header] = "email";
      else if (lower.includes("first") && lower.includes("name")) autoMapping[header] = "firstName";
      else if (lower.includes("last") && lower.includes("name")) autoMapping[header] = "lastName";
      else if (lower.includes("company")) autoMapping[header] = "company";
      else if (lower.includes("job") || lower.includes("title")) autoMapping[header] = "jobTitle";
    });
    return autoMapping;
  });

  const hasEmailMapped = Object.values(mapping).includes("email");

  const handleNext = () => {
    // Transform raw data into contacts
    const contacts: ContactData[] = [];
    const emailIndex = headers.findIndex((h) => mapping[h] === "email");

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const email = row[emailIndex];

      if (!email) continue;

      const customVars: Record<string, any> = {};
      headers.forEach((header, j) => {
        const field = mapping[header];
        if (field && field !== "email" && field !== "skip" && field !== "timezone") {
          customVars[field] = row[j];
        }
      });

      const timezoneIndex = headers.findIndex((h) => mapping[h] === "timezone");
      const timezone = timezoneIndex >= 0 ? row[timezoneIndex] : undefined;

      contacts.push({ email, customVars, timezone });
    }

    onNext(mapping, contacts);
  };

  return (
    <WizardContainer>
      <StepHeader
        stepNumber={3}
        stepLabel="Field Mapping"
        title="Map Your Fields"
        description="Match your columns to contact fields"
      />

      <div className="mb-12 space-y-4">
        {headers.map((header) => (
          <div
            key={header}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{header}</p>
              <p className="text-sm text-slate-600">
                Sample: {rawData[1]?.[headers.indexOf(header)]}
              </p>
            </div>
            <div className="w-64">
              <select
                value={mapping[header] || "skip"}
                onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                {FIELD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} {option.required ? "*" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <WizardFooter
        onBack={onBack}
        onCancel={onCancel}
        onNext={handleNext}
        nextLabel="Next: Review"
        nextDisabled={!hasEmailMapped}
      />
    </WizardContainer>
  );
}
