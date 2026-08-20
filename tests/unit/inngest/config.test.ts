import { describe, expect, it } from "vitest";

import { readInngestConcurrency } from "../../../inngest/client";

describe("readInngestConcurrency", () => {
  it("defaults to five shared account slots", () => {
    expect(readInngestConcurrency({})).toEqual({
      limit: 5,
      key: '"samrian"',
      scope: "account",
    });
  });

  it("reads a positive environment override", () => {
    expect(readInngestConcurrency({ INNGEST_CONCURRENCY: "3" }).limit).toBe(3);
  });

  it.each(["0", "-1", "1.5", "many"])("rejects invalid value %s", (value) => {
    expect(() => readInngestConcurrency({ INNGEST_CONCURRENCY: value })).toThrow(
      "INNGEST_CONCURRENCY must be a positive integer"
    );
  });
});
