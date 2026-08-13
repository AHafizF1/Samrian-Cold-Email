"use client";

import { scopes, type Scope } from "@samrian/contracts";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type KeyMetadata = {
  id: string;
  name: string;
  scopes: Scope[];
  createdAt: string;
  obfuscatedValue?: string;
};

export function ApiKeys() {
  const [keys, setKeys] = React.useState<KeyMetadata[]>([]);
  const [name, setName] = React.useState("");
  const [selected, setSelected] = React.useState<Scope[]>([]);
  const [created, setCreated] = React.useState<string>();
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    const response = await fetch("/api/settings/api-keys");
    if (!response.ok) throw new Error("Could not load API keys");
    setKeys(await response.json());
  }, []);

  React.useEffect(() => {
    load().catch((loadError: unknown) =>
      setError(loadError instanceof Error ? loadError.message : "Could not load API keys")
    );
  }, [load]);

  async function create() {
    setError("");
    const response = await fetch("/api/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scopes: selected }),
    });
    if (!response.ok) {
      setError("Could not create API key");
      return;
    }
    const result = (await response.json()) as KeyMetadata & { value: string };
    setCreated(result.value);
    setKeys((current) => [result, ...current]);
    setName("");
    setSelected([]);
  }

  async function revoke(key: KeyMetadata) {
    const response = await fetch(`/api/settings/api-keys/${encodeURIComponent(key.id)}/revoke`, {
      method: "POST",
    });
    if (!response.ok) {
      setError("Could not revoke API key");
      return;
    }
    await load();
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-base font-medium text-slate-950">API keys</h2>
        <p className="text-sm text-slate-600">Create separate scoped keys for CLI and CI use.</p>
      </div>

      {created ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-950">Key shown once</p>
          <code className="mt-2 block break-all text-amber-950">{created}</code>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="api-key-name">Key name</Label>
        <Input id="api-key-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {scopes.map((scope) => (
          <label key={scope} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              aria-label={scope}
              checked={selected.includes(scope)}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, scope]
                    : current.filter((value) => value !== scope)
                )
              }
            />
            {scope}
          </label>
        ))}
      </div>

      <div>
        <Button disabled={!name.trim() || selected.length === 0} onClick={create}>
          Create key
        </Button>
      </div>

      <div className="divide-y divide-slate-200 border-t border-slate-200">
        {keys.map((key) => (
          <div key={key.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-slate-950">{key.name}</p>
              <p className="truncate text-sm text-slate-600">{key.scopes.join(", ")}</p>
            </div>
            <Button variant="outline" onClick={() => revoke(key)} aria-label={`Revoke ${key.name}`}>
              Revoke
            </Button>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
