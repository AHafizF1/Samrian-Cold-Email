"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

export interface AddMailboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Provider = "google" | "microsoft" | "smtp";

export function AddMailboxDialog({ open, onOpenChange }: AddMailboxDialogProps) {
  const [step, setStep] = React.useState<"choose" | "form">("choose");
  const [selectedProvider, setSelectedProvider] = React.useState<Provider | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: "",
    username: "",
    password: "",
    dailySendLimit: 50,
  });

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setStep("choose");
      setSelectedProvider(null);
      setFormData({
        name: "",
        username: "",
        password: "",
        dailySendLimit: 50,
      });
    }
  }, [open]);

  const handleProviderSelect = (provider: Provider) => {
    setSelectedProvider(provider);
    if (provider === "google" || provider === "microsoft") {
      // Redirect to OAuth flow immediately
      const route = provider === "google" ? "/api/auth/google" : "/api/auth/microsoft";
      window.location.href = route;
    } else {
      // Show SMTP form
      setStep("form");
    }
  };

  const handleSmtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/mailboxes/connect-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          provider: "mailpool", // Default SMTP provider
          username: formData.username,
          password: formData.password,
          dailySendLimit: formData.dailySendLimit,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to add mailbox");
      }

      toast.success("Mailbox added successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add mailbox");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] font-[family-name:var(--font-ibm-plex)] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            {step === "form" && (
              <button
                onClick={() => setStep("choose")}
                className="p-1 -ml-1 hover:bg-slate-100 rounded transition-colors"
                aria-label="Back to provider selection"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <div>
              <DialogTitle className="text-xl">Add Mailbox</DialogTitle>
              <DialogDescription className="mt-1">
                {step === "choose"
                  ? "Choose how you want to connect your email account"
                  : "Enter your SMTP credentials to connect"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6">
          {step === "choose" ? (
            <div className="grid gap-3">
              {/* Google Workspace Card */}
              <button
                onClick={() => handleProviderSelect("google")}
                className="group relative flex items-center gap-4 p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-200 text-left"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <Image
                    src="/logos/google.svg"
                    alt="Google"
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                    Google Workspace
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">Connect via OAuth (recommended)</p>
                </div>
                <div className="flex-shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>

              {/* Microsoft 365 Card */}
              <button
                onClick={() => handleProviderSelect("microsoft")}
                className="group relative flex items-center gap-4 p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-200 text-left"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <Image
                    src="/logos/microsoft.svg"
                    alt="Microsoft"
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                    Microsoft 365
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">Connect via OAuth (recommended)</p>
                </div>
                <div className="flex-shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>

              {/* SMTP/IMAP Card */}
              <button
                onClick={() => handleProviderSelect("smtp")}
                className="group relative flex items-center gap-4 p-4 border-2 border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 text-left"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <svg
                    className="w-7 h-7 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">
                    SMTP / IMAP
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">Manual configuration (advanced)</p>
                </div>
                <div className="flex-shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSmtpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                  Friendly Name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. Sales Account 1"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-slate-700">
                  Email Address
                </Label>
                <Input
                  id="username"
                  type="email"
                  placeholder="hello@example.com"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  App Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <p className="text-xs text-slate-500">
                  Use an app-specific password, not your main account password
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dailyLimit" className="text-sm font-medium text-slate-700">
                  Daily Send Limit
                </Label>
                <Input
                  id="dailyLimit"
                  type="number"
                  min={1}
                  max={2000}
                  value={formData.dailySendLimit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dailySendLimit: parseInt(e.target.value) || 50,
                    })
                  }
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding…" : "Add Mailbox"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
