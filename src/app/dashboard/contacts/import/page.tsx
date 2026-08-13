"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { MethodSelection } from "@/components/add-contacts-wizard/method-selection";
import { CsvUpload } from "@/components/add-contacts-wizard/csv-upload";
import { ManualEntry } from "@/components/add-contacts-wizard/manual-entry";
import { FieldMapping } from "@/components/add-contacts-wizard/field-mapping";
import { ReviewValidation } from "@/components/add-contacts-wizard/review-validation";
import { Success } from "@/components/add-contacts-wizard/success";
import type { WizardStep, ImportMethod, ContactData } from "@/components/add-contacts-wizard";

export default function ImportContactsPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<WizardStep>("method");
  const [method, setMethod] = React.useState<ImportMethod>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [rawData, setRawData] = React.useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = React.useState<Record<string, string>>({});
  const [contacts, setContacts] = React.useState<ContactData[]>([]);
  const [validContacts, setValidContacts] = React.useState<ContactData[]>([]);

  const handleCancel = () => {
    router.push("/dashboard/contacts");
  };

  const handleSuccess = () => {
    router.push("/dashboard/contacts");
  };

  // Progress indicator
  const steps = [
    { id: "method", label: "Method", number: 1 },
    { id: "upload", label: method === "csv" ? "Upload CSV" : "Enter Details", number: 2 },
    { id: "mapping", label: "Map Fields", number: 3 },
    { id: "review", label: "Review", number: 4 },
    { id: "success", label: "Complete", number: 5 },
  ];

  // Filter steps based on method
  const visibleSteps =
    method === "manual"
      ? steps.filter((s) => s.id !== "mapping")
      : steps.filter((s) => s.id !== "method" || step !== "method");

  const currentStepIndex = visibleSteps.findIndex((s) => s.id === step);

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
      <PageHeader
        title="Import Contacts"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Contacts", href: "/dashboard/contacts" },
          { label: "Import" },
        ]}
      />

      <div className="mx-auto w-full max-w-5xl p-10">
        {/* Progress Stepper - Only show after method selection */}
        {step !== "method" && (
          <div className="mb-12">
            <div className="flex items-center justify-between">
              {visibleSteps.map((s, index) => (
                <React.Fragment key={s.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full font-[family-name:var(--font-plus-jakarta)] font-bold transition-all ${
                        index <= currentStepIndex
                          ? "bg-gradient-to-br from-[#3525cd] to-[#4f46e5] text-white"
                          : "border-2 border-slate-300 bg-white text-slate-400"
                      }`}
                    >
                      {index < currentStepIndex ? (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        s.number
                      )}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium ${
                        index <= currentStepIndex ? "text-slate-900" : "text-slate-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {index < visibleSteps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 transition-all ${
                        index < currentStepIndex ? "bg-indigo-600" : "bg-slate-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {step === "method" && (
            <MethodSelection
              onSelect={(selectedMethod) => {
                setMethod(selectedMethod);
                setStep("upload");
              }}
              onCancel={handleCancel}
            />
          )}

          {step === "upload" && method === "csv" && (
            <CsvUpload
              onNext={(uploadedFile, data) => {
                setFile(uploadedFile);
                setRawData(data);
                setStep("mapping");
              }}
              onBack={() => setStep("method")}
              onCancel={handleCancel}
            />
          )}

          {step === "upload" && method === "manual" && (
            <ManualEntry
              onNext={(manualContacts) => {
                setContacts(manualContacts);
                setStep("review");
              }}
              onBack={() => setStep("method")}
              onCancel={handleCancel}
            />
          )}

          {step === "mapping" && (
            <FieldMapping
              rawData={rawData}
              onNext={(mapping, mappedContacts) => {
                setFieldMapping(mapping);
                setContacts(mappedContacts);
                setStep("review");
              }}
              onBack={() => setStep("upload")}
              onCancel={handleCancel}
            />
          )}

          {step === "review" && (
            <ReviewValidation
              contacts={contacts}
              onImport={(imported) => {
                setValidContacts(imported);
                setStep("success");
              }}
              onBack={() => setStep(method === "manual" ? "upload" : "mapping")}
              onCancel={handleCancel}
            />
          )}

          {step === "success" && (
            <Success contactCount={validContacts.length} onClose={handleSuccess} />
          )}
        </div>
      </div>
    </div>
  );
}
