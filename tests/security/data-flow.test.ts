import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("sensitive data flow", () => {
  it("keeps queue payloads free of credentials, raw email, and recipient addresses", () => {
    const queue = readFileSync("src/server/ports/queue.ts", "utf8");
    const jobs = readFileSync("src/server/jobs/types.ts", "utf8");
    const source = `${queue}\n${jobs}`;

    expect(source).not.toMatch(/encryptedPassword|encryptedRefreshToken|accessToken|refreshToken/);
    expect(source).not.toMatch(/rawBody\??:\s*string/);
    expect(source).not.toMatch(/type Bounce(?:Job|Payload)[\s\S]*?\n\s*email:\s*string/);
  });

  it("keeps archived mailbox credentials out of persistent rows", () => {
    const source = readFileSync("src/server/repos/mailboxes.ts", "utf8");
    const archive = source.slice(
      source.indexOf("async archive"),
      source.indexOf("async resetDaily")
    );

    expect(archive).toContain("encryptedPassword: null");
    expect(archive).toContain("encryptedRefreshToken: null");
    expect(archive).toContain("encryptedAccessToken: null");
  });
});
