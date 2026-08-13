import { describe, expect, test, vi } from "vitest";

import { resolveOutboundHost } from "../../../src/server/network/outbound";

describe("outbound host policy", () => {
  test.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("rejects unsafe address %s", async (address) => {
    await expect(
      resolveOutboundHost(address, { lookup: vi.fn(async () => [{ address, family: 4 }]) })
    ).rejects.toThrow("public");
  });

  test.each([
    "https://smtp.example.com",
    "user@smtp.example.com",
    "smtp.example.com/path",
    "2130706433",
    "0x7f000001",
    "127.1",
    "",
  ])("rejects ambiguous host %s", async (host) => {
    await expect(resolveOutboundHost(host)).rejects.toThrow("host");
  });

  test("pins one resolved public address while preserving TLS server name", async () => {
    const lookup = vi.fn(async () => [
      { address: "8.8.8.8", family: 4 as const },
      { address: "2001:4860:4860::8888", family: 6 as const },
    ]);

    await expect(resolveOutboundHost("smtp.example.com", { lookup })).resolves.toEqual({
      address: "8.8.8.8",
      servername: "smtp.example.com",
    });
  });

  test("rejects hostname when any DNS answer is unsafe", async () => {
    await expect(
      resolveOutboundHost("smtp.example.com", {
        lookup: vi.fn(async () => [
          { address: "93.184.216.34", family: 4 },
          { address: "127.0.0.1", family: 4 },
        ]),
      })
    ).rejects.toThrow("public");
  });

  test("permits private hosts only through deployment policy", async () => {
    await expect(
      resolveOutboundHost("mail.internal", {
        allowPrivate: true,
        lookup: vi.fn(async () => [{ address: "10.0.0.5", family: 4 }]),
      })
    ).resolves.toEqual({ address: "10.0.0.5", servername: "mail.internal" });
  });
});
