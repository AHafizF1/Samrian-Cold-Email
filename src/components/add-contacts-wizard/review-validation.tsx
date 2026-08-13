"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ContactData } from "./index";
import { StepHeader, WizardFooter, WizardContainer } from "./shared";

interface ReviewValidationProps {
  contacts: ContactData[];
  onImport: (validContacts: ContactData[]) => void;
  onBack: () => void;
  onCancel: () => void;
}

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export function ReviewValidation({ contacts, onImport, onBack, onCancel }: ReviewValidationProps) {
  const [isImporting, setIsImporting] = React.useState(false);
  const [skipInvalid, setSkipInvalid] = React.useState(true);

  const validContacts = contacts.filter((c) => isValidEmail(c.email));
  const invalidContacts = contacts.filter((c) => !isValidEmail(c.email));

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const contactsToImport = skipInvalid ? validContacts : contacts;

      await requestJson("/api/contacts", {
        method: "POST",
        body: JSON.stringify({
          contacts: contactsToImport.map((c) => ({
            email: c.email,
            customVars: c.customVars,
            timezone: c.timezone,
          })),
        }),
      });

      onImport(contactsToImport);
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import contacts. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <WizardContainer>
      <StepHeader
        stepNumber={4}
        stepLabel="Review & Validation"
        title="Review Contacts"
        description="Verify your contacts before importing"
      />

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-3xl font-bold text-slate-900">{contacts.length}</p>
          <p className="text-sm text-slate-600">Total Contacts</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <p className="text-3xl font-bold text-green-600">{validContacts.length}</p>
          <p className="text-sm text-green-700">Valid Emails</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-3xl font-bold text-red-600">{invalidContacts.length}</p>
          <p className="text-sm text-red-700">Invalid Emails</p>
        </div>
      </div>

      {/* Options */}
      <div className="mb-8 space-y-3">
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input
            type="checkbox"
            checked={skipInvalid}
            onChange={(e) => setSkipInvalid(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
          />
          <span className="text-sm font-medium text-slate-700">Skip invalid emails</span>
        </label>
      </div>

      {/* Contact List */}
      <div className="mb-12 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Company
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.map((contact, i) => {
              const isValid = isValidEmail(contact.email);
              return (
                <tr key={i} className={!isValid ? "bg-red-50/50" : ""}>
                  <td className="px-6 py-4 text-sm text-slate-900">{contact.email}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {contact.customVars?.firstName} {contact.customVars?.lastName}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {contact.customVars?.company || "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {isValid ? (
                      <CheckCircle2 className="mx-auto h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="mx-auto h-5 w-5 text-red-600" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <WizardFooter
        onBack={onBack}
        onCancel={onCancel}
        onNext={handleImport}
        nextLabel={
          isImporting
            ? "Importing..."
            : `Import ${skipInvalid ? validContacts.length : contacts.length} Contacts`
        }
        nextDisabled={isImporting || (skipInvalid && validContacts.length === 0)}
        isLoading={isImporting}
      />
    </WizardContainer>
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
