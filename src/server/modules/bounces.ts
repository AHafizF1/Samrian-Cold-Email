import type { RawMessage } from "../jobs/types";

const HARD_BOUNCE_PATTERNS = [
  "user unknown",
  "mailbox not found",
  "does not exist",
  "no such user",
  "invalid recipient",
  "address rejected",
  "recipient rejected",
  "550",
  "551",
  "552",
  "553",
  "554",
] as const;

const SOFT_BOUNCE_PATTERNS = [
  "mailbox full",
  "over quota",
  "temporarily rejected",
  "try again later",
  "service unavailable",
  "connection timed out",
  "rate limit",
  "421",
  "450",
  "451",
  "452",
] as const;

export type BounceParseResult = {
  bounceType: "hard" | "soft";
  dsnCode?: string;
  email?: string;
  rawBody: string;
};

export function classifyBounce(input: {
  bounceType?: "hard" | "soft";
  dsnCode?: string;
  rawBody?: string;
}): "hard" | "soft" {
  if (input.bounceType === "soft" || input.bounceType === "hard") return input.bounceType;
  if (input.dsnCode?.startsWith("5")) return "hard";
  if (input.dsnCode?.startsWith("4")) return "soft";

  const rawBody = input.rawBody?.toLowerCase();
  if (rawBody) {
    if (SOFT_BOUNCE_PATTERNS.some((pattern) => rawBody.includes(pattern))) return "soft";
    if (HARD_BOUNCE_PATTERNS.some((pattern) => rawBody.includes(pattern))) return "hard";
  }

  return "soft";
}

export function parseBounce(message: RawMessage): BounceParseResult {
  const rawBody = [
    message.subject,
    message.textBody,
    message.htmlBody,
    ...Object.entries(message.headers).flatMap(([key, value]) => [`${key}: ${value}`]),
  ]
    .filter(Boolean)
    .join("\n");

  const dsnCode = rawBody.match(/\b([45]\.\d+\.\d+)\b/)?.[1];
  const email =
    getHeader(message.headers, "x-failed-recipients") ??
    rawBody.match(/Final-Recipient:\s*rfc822;\s*([^\s;]+)/i)?.[1] ??
    rawBody.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];

  return {
    bounceType: classifyBounce({ dsnCode, rawBody }),
    dsnCode,
    email,
    rawBody,
  };
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return entry?.[1];
}
