import { createHash } from "node:crypto";

export type IdempotencyStore = {
  get(key: string): Promise<{ fingerprint: string; result?: unknown } | null>;
  reserve(key: string, fingerprint: string): Promise<boolean>;
  complete(key: string, result: unknown): Promise<void>;
};

export async function runIdempotent<T>(
  input: { key: string; payload: unknown },
  store: IdempotencyStore,
  execute: () => Promise<T>
): Promise<T> {
  const fingerprint = createHash("sha256").update(stableJson(input.payload)).digest("hex");
  const existing = await store.get(input.key);
  if (existing) return existingResult<T>(existing, fingerprint);

  if (!(await store.reserve(input.key, fingerprint))) {
    const concurrent = await store.get(input.key);
    if (concurrent) return existingResult<T>(concurrent, fingerprint);
    throw new Error("Idempotent request in progress");
  }

  try {
    const result = await execute();
    await store.complete(input.key, result);
    return result;
  } catch (error) {
    throw error;
  }
}

function existingResult<T>(
  record: { fingerprint: string; result?: unknown },
  fingerprint: string
): T {
  if (record.fingerprint !== fingerprint) {
    throw new Error("Idempotency key reused with different payload");
  }
  if (record.result === undefined) throw new Error("Idempotent request in progress");
  return record.result as T;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
