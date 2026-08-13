import * as React from "react";
import type { CampaignDraft } from "../page";
import { Plus, Trash2, Mail, Eye, AlertCircle, CheckCircle2 } from "lucide-react";
import { useApi } from "@/hooks/use-api";

interface EmailSequenceStepProps {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
}

const VARIABLES = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "email", label: "Email" },
];

export function EmailSequenceStep({ draft, setDraft }: EmailSequenceStepProps) {
  const [activeStepIndex, setActiveStepIndex] = React.useState(0);
  const [previewContactIndex, setPreviewContactIndex] = React.useState(0);

  const { data: contacts } = useApi<{ contacts: any[] }>("/api/contacts?limit=10");
  const previewContacts = contacts?.contacts || [];

  const activeStep = draft.steps[activeStepIndex];

  const addStep = () => {
    setDraft((prev) => ({
      ...prev,
      steps: [...prev.steps, { subject: "", body: "" }],
    }));
    setActiveStepIndex(draft.steps.length);
  };

  const removeStep = (index: number) => {
    if (draft.steps.length === 1) {
      alert("Campaign must have at least one step");
      return;
    }
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
    if (activeStepIndex >= draft.steps.length - 1) {
      setActiveStepIndex(Math.max(0, draft.steps.length - 2));
    }
  };

  const updateStep = (index: number, field: "subject" | "body", value: string) => {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => (i === index ? { ...step, [field]: value } : step)),
    }));
  };

  const insertVariable = (varKey: string) => {
    if (!activeStep) return;
    const variable = `{{${varKey}}}`;
    // Insert at cursor position in body
    updateStep(activeStepIndex, "body", activeStep.body + variable);
  };

  // Validate spintax (basic check)
  const validateSpintax = (text: string) => {
    const openBraces = (text.match(/{/g) || []).length;
    const closeBraces = (text.match(/}/g) || []).length;
    return openBraces === closeBraces;
  };

  const renderPreview = () => {
    if (!activeStep || previewContacts.length === 0) {
      return <p className="text-sm text-slate-400">No preview available</p>;
    }

    const contact = previewContacts[previewContactIndex];
    let subject = activeStep.subject;
    let body = activeStep.body;

    // Replace variables
    VARIABLES.forEach((v) => {
      const value = contact.customVars?.[v.key] || contact.email;
      subject = subject.replace(new RegExp(`{{${v.key}}}`, "g"), value);
      body = body.replace(new RegExp(`{{${v.key}}}`, "g"), value);
    });

    // Simple spintax handling (pick first option)
    subject = subject.replace(/{([^}]+)}/g, (_, options) => options.split("|")[0]);
    body = body.replace(/{([^}]+)}/g, (_, options) => options.split("|")[0]);

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <p className="text-xs text-slate-500">From: you@company.com</p>
          <p className="text-xs text-slate-500">To: {contact.email}</p>
          <p className="mt-2 font-bold text-slate-900">{subject}</p>
        </div>
        <div className="whitespace-pre-wrap text-sm text-slate-700">{body}</div>
      </div>
    );
  };

  const subjectValid = activeStep ? validateSpintax(activeStep.subject) : true;
  const bodyValid = activeStep ? validateSpintax(activeStep.body) : true;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left: Timeline */}
      <div className="col-span-3">
        <h3 className="mb-4 text-sm font-bold text-slate-700">Sequence Timeline</h3>
        <div className="relative space-y-4">
          {/* Vertical line */}
          <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-slate-200" />

          {draft.steps.map((step, index) => (
            <button
              key={index}
              onClick={() => setActiveStepIndex(index)}
              className={`relative w-full rounded-lg border-2 p-4 text-left transition-all ${
                activeStepIndex === index
                  ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100"
                  : "border-slate-200 bg-white hover:border-indigo-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                    activeStepIndex === index
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Mail className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-900">Step {index + 1}</p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {step.subject || "No subject"}
                  </p>
                </div>
              </div>
            </button>
          ))}

          {/* Add Step Button */}
          <button
            onClick={addStep}
            className="w-full rounded-lg border-2 border-dashed border-slate-200 bg-white p-4 text-sm font-bold text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-600"
          >
            <Plus className="mx-auto h-5 w-5" />
            Add Step
          </button>
        </div>
      </div>

      {/* Center: Editor */}
      <div className="col-span-6">
        {activeStep ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Edit Step {activeStepIndex + 1}</h3>
              {draft.steps.length > 1 && (
                <button
                  onClick={() => removeStep(activeStepIndex)}
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Step
                </button>
              )}
            </div>

            {/* Variable Picker */}
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-500">
                Insert Variable:
              </label>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Use spintax for variations: {"{option1|option2|option3}"}
              </p>
            </div>

            {/* Subject */}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Subject Line <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={activeStep.subject}
                onChange={(e) => updateStep(activeStepIndex, "subject", e.target.value)}
                placeholder="e.g., Quick question about {{company}}"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 font-mono text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              {!subjectValid && (
                <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  Unbalanced braces in spintax
                </div>
              )}
            </div>

            {/* Body */}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Email Body <span className="text-red-500">*</span>
              </label>
              <textarea
                value={activeStep.body}
                onChange={(e) => updateStep(activeStepIndex, "body", e.target.value)}
                placeholder="Hi {{firstName}},&#10;&#10;I noticed {{company}} is..."
                rows={12}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 font-mono text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              {!bodyValid && (
                <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  Unbalanced braces in spintax
                </div>
              )}
              {subjectValid && bodyValid && (
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Syntax valid
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12">
            <div className="text-center">
              <Mail className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="text-sm text-slate-500">No steps yet. Click "Add Step" to begin.</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Preview */}
      <div className="col-span-3">
        <div className="sticky top-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Eye className="h-4 w-4" />
              Preview
            </h3>
          </div>

          {previewContacts.length > 0 && (
            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium text-slate-500">Preview as:</label>
              <select
                value={previewContactIndex}
                onChange={(e) => setPreviewContactIndex(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-100"
              >
                {previewContacts.map((contact: any, index: any) => (
                  <option key={contact._id} value={index}>
                    {contact.customVars?.name || contact.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            {renderPreview()}
          </div>
        </div>
      </div>
    </div>
  );
}
