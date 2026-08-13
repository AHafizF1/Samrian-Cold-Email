import { describe, expect, test } from "vitest";

import { ac, admin, member, owner } from "../../lib/permissions";

describe("auth permissions", () => {
  test("keeps shared organization roles available", () => {
    expect(ac).toBeTruthy();
    expect(owner).toBeTruthy();
    expect(admin).toBeTruthy();
    expect(member).toBeTruthy();
  });
});
