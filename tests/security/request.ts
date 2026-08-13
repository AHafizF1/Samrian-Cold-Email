import type { AutomationPrincipal, MachineCredential } from "../../src/server/auth/machine";

export function credential(value: AutomationPrincipal | null): MachineCredential {
  return {
    create: async () => {
      throw new Error("unused");
    },
    list: async () => [],
    verify: async () => value,
    revoke: async () => ({ revoked: true, reversible: false, provider: "better-auth" }),
  };
}

export function apiRequest(
  path: string,
  input: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const headers = new Headers(input.headers);
  if (input.token) headers.set("authorization", `Bearer ${input.token}`);
  if (input.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`https://app.example.com${path}`, {
    method: input.method ?? "GET",
    headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
}
