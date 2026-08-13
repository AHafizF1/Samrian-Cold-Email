import { createHash } from "node:crypto";

import type { McpMode } from "./config";

const MAX_FINGERPRINT_INPUT = 8_192;

export type McpCallDecision =
  | { allowed: true; release(): void }
  | { allowed: false; code: "AGENT_LOOP_DETECTED" | "CONCURRENCY_LIMITED"; retryAfterMs: number };

export function createMcpCallGuard(input: {
  mode: McpMode;
  now?: () => number;
  concurrency?: number;
  identicalMax?: number;
}) {
  const now = input.now ?? Date.now;
  const concurrency = input.concurrency ?? (input.mode === "operator" ? 2 : 3);
  const identicalMax = input.identicalMax ?? (input.mode === "operator" ? 5 : 10);
  const calls = new Map<string, { count: number; resetAt: number }>();
  let active = 0;

  return {
    enter(name: string, args: unknown): McpCallDecision {
      const at = now();
      const key = `${name}:${createHash("sha256")
        .update(stable(args).slice(0, MAX_FINGERPRINT_INPUT))
        .digest("base64url")}`;
      const current = calls.get(key);
      const window =
        !current || current.resetAt <= at ? { count: 0, resetAt: at + 60_000 } : current;
      if (window.count >= identicalMax) {
        return {
          allowed: false,
          code: "AGENT_LOOP_DETECTED",
          retryAfterMs: Math.max(1, window.resetAt - at),
        };
      }
      if (active >= concurrency) {
        return { allowed: false, code: "CONCURRENCY_LIMITED", retryAfterMs: 1_000 };
      }
      window.count += 1;
      calls.set(key, window);
      active += 1;
      let released = false;
      return {
        allowed: true,
        release() {
          if (released) return;
          released = true;
          active -= 1;
        },
      };
    },
  };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
