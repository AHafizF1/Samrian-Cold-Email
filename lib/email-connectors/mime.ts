import type { SendOptions } from "./types";

const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export function buildMimeHeaders(message: SendOptions): string[] {
  const lines = [
    header("From", message.from),
    header("To", message.to),
    header("Subject", message.subject),
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
  ];

  for (const [name, value] of Object.entries(message.headers ?? {})) {
    lines.push(header(name, value));
  }
  if (message.inReplyTo) lines.push(header("In-Reply-To", message.inReplyTo));
  if (message.references?.length) {
    lines.push(header("References", message.references.join(" ")));
  }
  return lines;
}

function header(name: string, value: string): string {
  if (!HEADER_NAME.test(name) || /[\r\n]/.test(value)) {
    throw new Error(`Invalid email header: ${name}`);
  }
  return `${name}: ${value}`;
}
