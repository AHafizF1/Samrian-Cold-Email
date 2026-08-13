"use client";

import { Pencil, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = {
  id: string;
  name: string;
  slug: string;
  permissions: string[];
  builtIn: boolean;
};

type Member = {
  id: string;
  userId: string;
  email?: string;
  name?: string;
  role: string;
};

export function MembersRoles() {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [name, setName] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [editing, setEditing] = React.useState<Role | null>(null);
  const [email, setEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("member");
  const [status, setStatus] = React.useState("Loading members and roles...");

  const loadRoles = React.useCallback(async () => {
    const response = await fetch("/api/settings/roles");
    if (!response.ok) throw new Error("Could not load roles");
    const data = (await response.json()) as { roles: Role[]; permissions: string[] };
    setRoles(data.roles);
    setPermissions(data.permissions);
  }, []);

  const loadMembers = React.useCallback(async () => {
    const response = await fetch("/api/settings/members");
    if (!response.ok) throw new Error("Could not load members");
    setMembers((await response.json()) as Member[]);
  }, []);

  React.useEffect(() => {
    Promise.all([loadRoles(), loadMembers()])
      .then(() => setStatus(""))
      .catch((error) => setStatus(error instanceof Error ? error.message : "Could not load team"));
  }, [loadMembers, loadRoles]);

  async function saveRole() {
    setStatus(editing ? "Updating role..." : "Creating role...");
    const response = await fetch(
      editing ? `/api/settings/roles/${editing.id}` : "/api/settings/roles",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions: selected }),
      }
    );
    if (!response.ok) return setStatus(await readError(response));
    setName("");
    setSelected([]);
    setEditing(null);
    await loadRoles();
    setStatus(editing ? "Role updated" : "Role created");
  }

  function editRole(role: Role) {
    setEditing(role);
    setName(role.name);
    setSelected(role.permissions);
  }

  async function deleteRole(role: Role) {
    if (!window.confirm(`Delete ${role.name}? Members using it will become members.`)) return;
    setStatus("Deleting role...");
    const response = await fetch(`/api/settings/roles/${role.id}`, { method: "DELETE" });
    if (!response.ok) return setStatus(await readError(response));
    await Promise.all([loadRoles(), loadMembers()]);
    setStatus("Role deleted");
  }

  async function changeMember(member: Member, role: string) {
    setStatus("Updating member...");
    const response = await fetch("/api/settings/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, role }),
    });
    if (!response.ok) return setStatus(await readError(response));
    await loadMembers();
    setStatus("Member updated");
  }

  async function invite() {
    setStatus("Sending invite...");
    const response = await fetch("/api/settings/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: inviteRole }),
    });
    if (!response.ok) return setStatus(await readError(response));
    setEmail("");
    setStatus("Invitation sent");
  }

  const builtIn = roles.filter((role) => role.builtIn);
  const custom = roles.filter((role) => !role.builtIn);

  return (
    <section className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-base font-medium text-slate-950">Members and roles</h2>
        <p className="text-sm text-slate-600">
          Control team access with provider-managed roles and permissions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email">Invite email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-role">Invite role</Label>
          <select
            id="invite-role"
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value)}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.slug}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={invite} disabled={!email.trim()}>
          Send invite
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-950">Members</h3>
        <div className="mt-2 divide-y divide-slate-100 border-y border-slate-100">
          {members.map((member) => (
            <div
              key={member.id}
              className="grid gap-2 py-3 sm:grid-cols-[1fr_180px] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {member.name || member.email || member.userId}
                </p>
                {member.email && <p className="truncate text-xs text-slate-500">{member.email}</p>}
              </div>
              <select
                aria-label={`Role for ${member.email || member.userId}`}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={member.role}
                onChange={(event) => changeMember(member, event.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.slug}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {!members.length && !status && (
            <p className="py-3 text-sm text-slate-500">No members found.</p>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <RoleList title="Built-in roles" roles={builtIn} />
        <RoleList title="Custom roles" roles={custom} onDelete={deleteRole} onEdit={editRole} />
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="role-name">Role name</Label>
          <Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-slate-900">Permissions</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {permissions.map((permission) => (
              <label key={permission} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  aria-label={permission}
                  checked={selected.includes(permission)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, permission]
                        : current.filter((value) => value !== permission)
                    )
                  }
                />
                <span className="font-mono text-xs">{permission}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <Button onClick={saveRole} disabled={!name.trim()}>
            {editing ? "Update role" : "Create role"}
          </Button>
          {editing && (
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setName("");
                setSelected([]);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {status && (
        <p role="status" className="text-sm text-slate-600">
          {status}
        </p>
      )}
    </section>
  );
}

function RoleList({
  title,
  roles,
  onDelete,
  onEdit,
}: {
  title: string;
  roles: Role[];
  onDelete?: (role: Role) => void;
  onEdit?: (role: Role) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-950">{title}</h3>
      <div className="mt-2 divide-y divide-slate-100 border-y border-slate-100">
        {roles.map((role) => (
          <div key={role.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{role.name}</p>
              <p className="text-xs text-slate-500">{role.permissions.length} permissions</p>
            </div>
            <div className="flex">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${role.name}`}
                  title={`Edit ${role.name}`}
                  onClick={() => onEdit(role)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${role.name}`}
                  title={`Delete ${role.name}`}
                  onClick={() => onDelete(role)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {!roles.length && <p className="py-3 text-sm text-slate-500">None yet.</p>}
      </div>
    </div>
  );
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Operation failed";
}
