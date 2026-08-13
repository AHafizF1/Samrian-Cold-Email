import { describe, expect, test } from "vitest";

import { securityHeaders } from "../../next.config";

describe("browser security headers", () => {
  test("sets baseline anti-sniffing, framing, referrer, and browser capability policy", () => {
    const headers = new Map(securityHeaders.map(({ key, value }) => [key.toLowerCase(), value]));
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("permissions-policy")).toContain("camera=()");
  });
});
