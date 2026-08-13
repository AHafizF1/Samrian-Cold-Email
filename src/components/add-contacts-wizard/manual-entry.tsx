"use client";

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { ContactData } from "./index";
import { StepHeader, WizardFooter, WizardContainer } from "./shared";

interface ManualEntryProps {
  onNext: (contacts: ContactData[]) => void;
  onBack: () => void;
  onCancel: () => void;
}

interface ContactForm {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  timezone: string;
  customVars: Array<{ key: string; value: string }>;
}

const emptyContact: ContactForm = {
  email: "",
  firstName: "",
  lastName: "",
  company: "",
  timezone: "",
  customVars: [],
};

export function ManualEntry({ onNext, onBack, onCancel }: ManualEntryProps) {
  const [contacts, setContacts] = React.useState<ContactForm[]>([{ ...emptyContact }]);

  const addContact = () => {
    setContacts([...contacts, { ...emptyContact }]);
  };

  const removeContact = (index: number) => {
    if (contacts.length > 1) {
      setContacts(contacts.filter((_, i) => i !== index));
    }
  };

  const updateContact = (index: number, field: keyof ContactForm, value: any) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  };

  const addCustomVar = (contactIndex: number) => {
    const updated = [...contacts];
    updated[contactIndex].customVars.push({ key: "", value: "" });
    setContacts(updated);
  };

  const updateCustomVar = (
    contactIndex: number,
    varIndex: number,
    field: "key" | "value",
    value: string
  ) => {
    const updated = [...contacts];
    updated[contactIndex].customVars[varIndex][field] = value;
    setContacts(updated);
  };

  const removeCustomVar = (contactIndex: number, varIndex: number) => {
    const updated = [...contacts];
    updated[contactIndex].customVars.splice(varIndex, 1);
    setContacts(updated);
  };

  const handleNext = () => {
    // Convert to ContactData format
    const contactData: ContactData[] = contacts
      .filter((c) => c.email.trim()) // Only include contacts with email
      .map((c) => {
        const customVars: Record<string, any> = {};

        // Add standard fields
        if (c.firstName) customVars.firstName = c.firstName;
        if (c.lastName) customVars.lastName = c.lastName;
        if (c.company) customVars.company = c.company;
        if (c.firstName || c.lastName) {
          customVars.name = [c.firstName, c.lastName].filter(Boolean).join(" ");
        }

        // Add custom variables
        c.customVars.forEach((cv) => {
          if (cv.key.trim() && cv.value.trim()) {
            customVars[cv.key.trim()] = cv.value.trim();
          }
        });

        return {
          email: c.email.trim(),
          customVars,
          timezone: c.timezone || undefined,
        };
      });

    if (contactData.length > 0) {
      onNext(contactData);
    }
  };

  const isValid = contacts.some((c) => c.email.trim());

  return (
    <WizardContainer>
      <StepHeader
        stepNumber={2}
        stepLabel="Manual Entry"
        title="Add Contacts Manually"
        description="Enter contact details one by one with custom fields"
      />

      <div className="mb-8 max-h-[500px] space-y-6 overflow-y-auto pr-2">
        {contacts.map((contact, contactIndex) => (
          <div
            key={contactIndex}
            className="relative rounded-xl border-2 border-slate-200 bg-white p-6 transition-all hover:border-indigo-200"
          >
            {/* Remove Contact Button */}
            {contacts.length > 1 && (
              <button
                onClick={() => removeContact(contactIndex)}
                className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Remove contact"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            <h3 className="mb-4 font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-slate-900">
              Contact {contactIndex + 1}
            </h3>

            {/* Standard Fields */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => updateContact(contactIndex, "email", e.target.value)}
                  placeholder="sarah@company.com"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  First Name
                </label>
                <input
                  type="text"
                  value={contact.firstName}
                  onChange={(e) => updateContact(contactIndex, "firstName", e.target.value)}
                  placeholder="Sarah"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Last Name
                </label>
                <input
                  type="text"
                  value={contact.lastName}
                  onChange={(e) => updateContact(contactIndex, "lastName", e.target.value)}
                  placeholder="Jenkins"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Company
                </label>
                <input
                  type="text"
                  value={contact.company}
                  onChange={(e) => updateContact(contactIndex, "company", e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Timezone
                </label>
                <input
                  type="text"
                  value={contact.timezone}
                  onChange={(e) => updateContact(contactIndex, "timezone", e.target.value)}
                  placeholder="America/New_York"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Custom Variables */}
            {contact.customVars.length > 0 && (
              <div className="mb-4 space-y-3 border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Custom Variables
                </h4>
                {contact.customVars.map((cv, varIndex) => (
                  <div key={varIndex} className="flex gap-3">
                    <input
                      type="text"
                      value={cv.key}
                      onChange={(e) =>
                        updateCustomVar(contactIndex, varIndex, "key", e.target.value)
                      }
                      placeholder="Field name"
                      className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={cv.value}
                      onChange={(e) =>
                        updateCustomVar(contactIndex, varIndex, "value", e.target.value)
                      }
                      placeholder="Value"
                      className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => removeCustomVar(contactIndex, varIndex)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Custom Variable Button */}
            <button
              onClick={() => addCustomVar(contactIndex)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
            >
              <Plus className="h-4 w-4" />
              Add Custom Variable
            </button>
          </div>
        ))}
      </div>

      {/* Add Another Contact Button */}
      <button
        onClick={addContact}
        className="mb-8 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-4 text-sm font-semibold text-slate-600 transition-all hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600"
      >
        <Plus className="h-5 w-5" />
        Add Another Contact
      </button>

      <WizardFooter
        onCancel={onCancel}
        onBack={onBack}
        onNext={handleNext}
        nextLabel="Continue to Review"
        nextDisabled={!isValid}
      />
    </WizardContainer>
  );
}
