import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("email provider hardening", () => {
  test("Microsoft requests permission needed to mark processed messages read", () => {
    const source = readFileSync(resolve("src/app/api/auth/microsoft/route.ts"), "utf8");
    expect(source).toContain('"Mail.ReadWrite"');
    expect(source).not.toMatch(/"Mail\.Read"/);
  });

  test("custom IMAP requires encrypted transport", () => {
    const source = readFileSync(resolve("lib/email-connectors/smtp-imap.ts"), "utf8");
    expect(source).toContain("secure: imapPort === 993");
    expect(source).toContain("doSTARTTLS: imapPort !== 993");
  });
});
