import { Inngest } from "inngest";

export function readInngestConcurrency(env: Record<string, string | undefined> = process.env) {
  const raw = env.INNGEST_CONCURRENCY ?? "5";
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new Error("INNGEST_CONCURRENCY must be a positive integer");
  }

  return {
    limit: Number(raw),
    key: '"samrian"',
    scope: "account" as const,
  };
}

export const inngestConcurrency = readInngestConcurrency();

export const inngest = new Inngest({
  id: "cold-email",
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
