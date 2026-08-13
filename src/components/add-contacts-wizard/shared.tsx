"use client";

import * as React from "react";

// Shared Step Header Component
interface StepHeaderProps {
  stepNumber: number;
  stepLabel: string;
  title: string;
  description: string;
}

export function StepHeader({ stepNumber, stepLabel, title, description }: StepHeaderProps) {
  return (
    <div className="mb-12 text-center">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-600">
        Step {stepNumber}: {stepLabel}
      </div>
      <h1 className="mb-4 font-[family-name:var(--font-plus-jakarta)] text-4xl font-bold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mx-auto max-w-2xl text-lg font-light text-slate-600">{description}</p>
    </div>
  );
}

// Shared Footer Navigation Component
interface WizardFooterProps {
  onBack?: () => void;
  onCancel: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  isLoading?: boolean;
  showBackButton?: boolean;
  leftContent?: React.ReactNode;
}

export function WizardFooter({
  onBack,
  onCancel,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  isLoading = false,
  showBackButton = true,
  leftContent,
}: WizardFooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-8">
      {leftContent || (
        <>
          {showBackButton && onBack ? (
            <button
              onClick={onBack}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <BackArrowIcon />
              Back
            </button>
          ) : (
            <div />
          )}
        </>
      )}

      <div className="flex gap-4">
        <CancelButton onClick={onCancel} disabled={isLoading} />
        {onNext && (
          <PrimaryButton
            onClick={onNext}
            disabled={nextDisabled || isLoading}
            isLoading={isLoading}
          >
            {nextLabel}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

// Shared Button Components
interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  isLoading?: boolean;
}

export function PrimaryButton({ onClick, disabled, children, isLoading }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-10 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400"
    >
      {children}
    </button>
  );
}

export function CancelButton({ onClick, disabled }: Omit<ButtonProps, "children" | "isLoading">) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-slate-300 px-8 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
    >
      Cancel
    </button>
  );
}

// Shared Icons
export function BackArrowIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export function CheckmarkIcon() {
  return (
    <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function SecurityShieldIcon() {
  return (
    <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

// Shared Container
interface WizardContainerProps {
  children: React.ReactNode;
}

export function WizardContainer({ children }: WizardContainerProps) {
  return <div className="p-12">{children}</div>;
}
