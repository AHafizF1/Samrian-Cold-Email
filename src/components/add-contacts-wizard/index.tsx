"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MethodSelection } from "./method-selection";
import { CsvUpload } from "./csv-upload";
import { ManualEntry } from "./manual-entry";
import { FieldMapping } from "./field-mapping";
import { ReviewValidation } from "./review-validation";
import { Success } from "./success";

export type WizardStep = "method" | "upload" | "mapping" | "review" | "success";
export type ImportMethod = "csv" | "manual" | "paste" | null;

export interface ContactData {
  email: string;
  customVars?: Record<string, any>;
  timezone?: string;
}

export interface WizardState {
  step: WizardStep;
  method: ImportMethod;
  file: File | null;
  rawData: string[][];
  fieldMapping: Record<string, string>;
  contacts: ContactData[];
  validContacts: ContactData[];
  invalidContacts: ContactData[];
  duplicates: ContactData[];
}

interface AddContactsWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddContactsWizard({ open, onOpenChange, onSuccess }: AddContactsWizardProps) {
  const [state, setState] = React.useState<WizardState>({
    step: "method",
    method: null,
    file: null,
    rawData: [],
    fieldMapping: {},
    contacts: [],
    validContacts: [],
    invalidContacts: [],
    duplicates: [],
  });

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const goToStep = (step: WizardStep) => {
    updateState({ step });
  };

  const handleClose = () => {
    // Reset state when closing
    setState({
      step: "method",
      method: null,
      file: null,
      rawData: [],
      fieldMapping: {},
      contacts: [],
      validContacts: [],
      invalidContacts: [],
      duplicates: [],
    });
    onOpenChange(false);
  };

  const handleSuccess = () => {
    onSuccess?.();
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        {state.step === "method" && (
          <MethodSelection
            onSelect={(method) => {
              updateState({ method });
              goToStep(method === "csv" ? "upload" : "upload");
            }}
            onCancel={handleClose}
          />
        )}

        {state.step === "upload" && state.method === "csv" && (
          <CsvUpload
            onNext={(file, rawData) => {
              updateState({ file, rawData });
              goToStep("mapping");
            }}
            onBack={() => goToStep("method")}
            onCancel={handleClose}
          />
        )}

        {state.step === "upload" && state.method === "manual" && (
          <ManualEntry
            onNext={(contacts) => {
              updateState({ contacts });
              goToStep("review");
            }}
            onBack={() => goToStep("method")}
            onCancel={handleClose}
          />
        )}

        {state.step === "mapping" && (
          <FieldMapping
            rawData={state.rawData}
            onNext={(fieldMapping, contacts) => {
              updateState({ fieldMapping, contacts });
              goToStep("review");
            }}
            onBack={() => goToStep("upload")}
            onCancel={handleClose}
          />
        )}

        {state.step === "review" && (
          <ReviewValidation
            contacts={state.contacts}
            onImport={(validContacts) => {
              updateState({ validContacts });
              goToStep("success");
            }}
            onBack={() => goToStep("mapping")}
            onCancel={handleClose}
          />
        )}

        {state.step === "success" && (
          <Success contactCount={state.validContacts.length} onClose={handleSuccess} />
        )}
      </DialogContent>
    </Dialog>
  );
}
