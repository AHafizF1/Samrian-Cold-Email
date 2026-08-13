import { decodeCursor, encodeCursor } from "../../../src/server/api/cursor";
import { describe, expect, it } from "vitest";

describe("API cursor", () => {
  it("round trips immutable contact ordering fields", () => {
    const value = { createdAt: "2026-07-13T10:00:00.000Z", id: "contact_1" };

    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  it("rejects malformed and unsupported cursors", () => {
    expect(() => decodeCursor("bad")).toThrow("Invalid cursor");
    const unsupported = Buffer.from(JSON.stringify({ v: 2, createdAt: "x", id: "x" })).toString(
      "base64url"
    );
    expect(() => decodeCursor(unsupported)).toThrow("Invalid cursor");
  });
});
