import { runIdempotent, type IdempotencyStore } from "../../../src/server/api/idempotency";
import { describe, expect, it, vi } from "vitest";

function store(): IdempotencyStore {
  const records = new Map<string, { fingerprint: string; result?: unknown }>();
  return {
    get: async (key) => records.get(key) ?? null,
    reserve: async (key, fingerprint) => {
      if (records.has(key)) return false;
      records.set(key, { fingerprint });
      return true;
    },
    complete: async (key, result) => {
      const record = records.get(key)!;
      records.set(key, { ...record, result });
    },
  };
}

describe("API idempotency", () => {
  it("returns completed result without executing duplicate mutation", async () => {
    const records = store();
    const execute = vi.fn().mockResolvedValue({ id: "campaign_1" });
    const input = { key: "same", payload: { name: "Launch" } };

    await expect(runIdempotent(input, records, execute)).resolves.toEqual({ id: "campaign_1" });
    await expect(runIdempotent(input, records, execute)).resolves.toEqual({ id: "campaign_1" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("rejects key reuse with changed payload", async () => {
    const records = store();
    await runIdempotent({ key: "same", payload: { name: "A" } }, records, async () => ({
      ok: true,
    }));

    await expect(
      runIdempotent({ key: "same", payload: { name: "B" } }, records, async () => ({ ok: true }))
    ).rejects.toThrow("Idempotency key reused with different payload");
  });

  it("keeps uncertain failed mutation reserved to prevent duplicate side effects", async () => {
    const records = store();
    await expect(
      runIdempotent({ key: "retry", payload: {} }, records, async () => {
        throw new Error("failed");
      })
    ).rejects.toThrow("failed");

    await expect(
      runIdempotent({ key: "retry", payload: {} }, records, async () => ({ ok: true }))
    ).rejects.toThrow("in progress");
  });
});
