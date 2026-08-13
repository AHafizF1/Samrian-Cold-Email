import { describe, expect, test } from "vitest";

import { csvCell } from "../../../src/server/modules/csv";

describe("csv output", () => {
  test.each(["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "\t=1+1", "\r=1+1"])(
    "neutralizes spreadsheet formula input %s",
    (value) => {
      expect(csvCell(value)).toBe(`"'${value.replaceAll('"', '""')}"`);
    }
  );

  test("escapes quotes without changing ordinary values", () => {
    expect(csvCell('Ada "Lovelace"')).toBe('"Ada ""Lovelace"""');
  });
});
