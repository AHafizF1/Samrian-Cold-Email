import * as React from "react";
import type { CampaignDraft } from "../page";
import { Users, Layers, Search, X } from "lucide-react";
import { useApi } from "@/hooks/use-api";

interface ContactAssignmentStepProps {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
}

type AssignmentMode = "group" | "specific";

export function ContactAssignmentStep({ draft, setDraft }: ContactAssignmentStepProps) {
  const [mode, setMode] = React.useState<AssignmentMode>(
    draft.targetGroupId ? "group" : "specific"
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedContactIds, setSelectedContactIds] = React.useState<Set<string>>(
    new Set(draft.targetContactIds || [])
  );

  const { data: groupData } = useApi<{ groups: any[] }>("/api/groups");
  const { data: contactData } = useApi<{ contacts: any[] }>("/api/contacts?limit=100");
  const contactGroups = groupData?.groups;
  const contacts = contactData;

  const filteredContacts = React.useMemo(() => {
    if (!contacts?.contacts) return [];
    if (!searchQuery.trim()) return contacts.contacts;

    const query = searchQuery.toLowerCase();
    return contacts.contacts.filter(
      (c: any) =>
        c.email.toLowerCase().includes(query) ||
        c.customVars?.name?.toLowerCase().includes(query) ||
        c.customVars?.company?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Update draft when mode or selection changes
  React.useEffect(() => {
    if (mode === "specific") {
      setDraft((prev) => ({
        ...prev,
        targetContactIds: Array.from(selectedContactIds),
        targetGroupId: undefined,
      }));
    }
  }, [mode, selectedContactIds, setDraft]);

  const handleGroupSelect = (groupId: string) => {
    setDraft((prev) => ({
      ...prev,
      targetGroupId: groupId,
      targetContactIds: undefined,
    }));
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-slate-900">
          Assign Contacts
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Choose which contacts should receive this campaign.
        </p>
      </div>

      {/* Mode Selection */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <button
          onClick={() => setMode("group")}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${
            mode === "group"
              ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100"
              : "border-slate-200 bg-white hover:border-indigo-300"
          }`}
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              mode === "group" ? "bg-indigo-600" : "bg-slate-100"
            }`}
          >
            <Layers className={`h-6 w-6 ${mode === "group" ? "text-white" : "text-slate-400"}`} />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-slate-900">Contact Group</h3>
            <p className="mt-1 text-xs text-slate-500">Target a saved group</p>
          </div>
        </button>

        <button
          onClick={() => setMode("specific")}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${
            mode === "specific"
              ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100"
              : "border-slate-200 bg-white hover:border-indigo-300"
          }`}
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              mode === "specific" ? "bg-indigo-600" : "bg-slate-100"
            }`}
          >
            <Users className={`h-6 w-6 ${mode === "specific" ? "text-white" : "text-slate-400"}`} />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-slate-900">Specific Contacts</h3>
            <p className="mt-1 text-xs text-slate-500">Select individual contacts</p>
          </div>
        </button>
      </div>

      {/* Group Selection */}
      {mode === "group" && (
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700">Select Contact Group</label>
          {!contactGroups || contactGroups.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-500">
                No contact groups found. Create a group first to use this option.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {contactGroups.map((group: any) => (
                <button
                  key={group._id}
                  onClick={() => handleGroupSelect(group._id)}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                    draft.targetGroupId === group._id
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-slate-200 bg-white hover:border-indigo-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">{group.name}</h4>
                      {group.description && (
                        <p className="mt-1 text-xs text-slate-500">{group.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      {group.isDynamic ? "Dynamic" : "Static"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Specific Contacts Selection */}
      {mode === "specific" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-700">Select Contacts</label>
            <span className="text-xs text-slate-500">{selectedContactIds.size} selected</span>
          </div>

          {/* Search */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-10 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Contact List */}
          <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-4">
            {filteredContacts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No contacts found</p>
            ) : (
              filteredContacts.map((contact: any) => {
                const isSelected = selectedContactIds.has(contact._id);
                return (
                  <button
                    key={contact._id}
                    onClick={() => toggleContact(contact._id)}
                    className={`w-full rounded-lg border p-3 text-left transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-slate-200 bg-white hover:border-indigo-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {contact.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {contact.customVars?.name || contact.email}
                        </p>
                        <p className="text-xs text-slate-500">{contact.email}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
