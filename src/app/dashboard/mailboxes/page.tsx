"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { columns } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";
import { AddMailboxDialog } from "./add-mailbox-dialog";
import { useApi } from "@/hooks/use-api";
import type { MailboxListItem } from "./columns";

export default function MailboxesPage() {
  const { data } = useApi<{ mailboxes: MailboxListItem[] }>("/api/mailboxes");
  const mailboxes = data?.mailboxes;
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
      <PageHeader
        title="Mailboxes"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Mailboxes" }]}
        actions={
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Mailbox
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-7xl p-10">
        <div className="mb-8">
          <p className="text-sm text-slate-500">Connect and manage your sending email accounts.</p>
        </div>

        {mailboxes === undefined ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-[250px]" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : mailboxes.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-24">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
              <svg
                className="h-7 w-7 text-slate-400"
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
            <h3 className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
              No mailboxes yet
            </h3>
            <p className="mt-2 max-w-md text-center text-sm text-slate-400">
              Connect your first email account to start sending campaigns.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="mt-8">
              <Plus className="mr-2 h-4 w-4" />
              Add Mailbox
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={mailboxes}
            searchKey="name"
            searchPlaceholder="Search mailboxes..."
          />
        )}
      </div>

      <AddMailboxDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </div>
  );
}
