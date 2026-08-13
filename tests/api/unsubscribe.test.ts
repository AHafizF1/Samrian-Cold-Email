import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GET, POST } from "../../src/app/api/unsubscribe/route";
import { unsubscribeContact } from "../../src/server/modules/unsubscribe";

vi.mock("../../src/server/modules/unsubscribe", () => ({
  unsubscribeContact: vi.fn(async () => ({ success: true, message: "Successfully unsubscribed." })),
}));

describe("unsubscribe api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("GET shows confirmation without changing state", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/unsubscribe?contactId=contact_1&c=campaign_1&t=token")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("Confirm unsubscribe");
    expect(unsubscribeContact).not.toHaveBeenCalled();
  });

  test("supports RFC 8058 one-click POST", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/unsubscribe?contactId=contact_1&c=campaign_1&t=token", {
        method: "POST",
        body: "List-Unsubscribe=One-Click",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );

    expect(response.status).toBe(200);
    expect(unsubscribeContact).toHaveBeenCalledWith({
      contactId: "contact_1",
      campaignId: "campaign_1",
      token: "token",
    });
  });
});
