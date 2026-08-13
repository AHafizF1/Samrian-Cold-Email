export type EmailDisplayInput = {
  textBody?: string;
  htmlBody?: string;
  maxExcerptLength?: number;
};

export type EmailDisplay = {
  text: string;
  excerpt: string;
};

export type EmailSender = {
  address?: string;
  name?: string;
  suspicious: boolean;
};

export type EmailLink = {
  url: string;
  hostname: string;
};

const QUOTE_PATTERNS = [
  /\nOn .+wrote:\s*[\s\S]*$/i,
  /\nFrom:\s.+[\s\S]*$/i,
  /\n-{2,}\s*Original Message\s*-{2,}[\s\S]*$/i,
  /\n>.+[\s\S]*$/m,
];
const MAX_DISPLAY_LENGTH = 256 * 1024;
const UNSAFE_TEXT_CONTROLS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;

export function buildEmailDisplay(input: EmailDisplayInput): EmailDisplay {
  const text = stripQuotedText(toText(input))
    .replace(UNSAFE_TEXT_CONTROLS, "")
    .trim()
    .slice(0, MAX_DISPLAY_LENGTH);
  const excerpt = compactWhitespace(text).slice(0, input.maxExcerptLength ?? 180);
  return { text, excerpt };
}

export function stripQuotedText(value: string): string {
  return QUOTE_PATTERNS.reduce((current, pattern) => current.replace(pattern, ""), value).trim();
}

export function parseEmailSender(value?: string): EmailSender {
  const safe = (value ?? "").replace(UNSAFE_TEXT_CONTROLS, "").trim();
  const match = safe.match(/^(.*?)<([^<>]+@[^<>]+)>$/);
  const rawAddress = (match?.[2] ?? safe).trim().toLowerCase();
  const at = rawAddress.lastIndexOf("@");
  if (at < 1) return { name: cleanSenderName(match?.[1]), suspicious: true };

  const local = rawAddress.slice(0, at);
  const domain = rawAddress.slice(at + 1);
  try {
    const hostname = new URL(`http://${domain}`).hostname;
    return {
      address: `${local}@${hostname}`,
      name: cleanSenderName(match?.[1]),
      suspicious: hostname !== domain,
    };
  } catch {
    return {
      address: rawAddress,
      name: cleanSenderName(match?.[1]),
      suspicious: true,
    };
  }
}

export function getSafeEmailLinks(value: string): EmailLink[] {
  const seen = new Set<string>();
  const links: EmailLink[] = [];
  for (const match of value.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const candidate = match[0].replace(/[),.;!?]+$/, "");
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      const url = parsed.toString();
      if (seen.has(url)) continue;
      seen.add(url);
      links.push({ url, hostname: parsed.hostname });
      if (links.length === 20) break;
    } catch {
      continue;
    }
  }
  return links;
}

function toText(input: EmailDisplayInput): string {
  if (input.textBody?.trim()) return input.textBody;
  return htmlToText(input.htmlBody ?? "");
}

function htmlToText(value: string): string {
  return compactWhitespace(
    value
      .replace(/<(script|style|svg|math|iframe|object|embed|form)\b[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (_, code: string) => decodeEntity(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => decodeEntity(parseInt(code, 16)))
  );
}

function decodeEntity(code: number): string {
  if (!Number.isSafeInteger(code) || code < 0 || code > 0x10ffff) return "";
  return String.fromCodePoint(code);
}

function compactWhitespace(value: string): string {
  return value
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanSenderName(value?: string): string | undefined {
  const name = value?.replace(/^["']|["']$/g, "").trim();
  return name || undefined;
}
