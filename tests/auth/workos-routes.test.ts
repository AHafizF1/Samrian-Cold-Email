import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const callback = vi.fn(async () => new Response(null, { status: 302 }));

vi.mock("@workos-inc/authkit-nextjs", () => ({
  handleAuth: vi.fn(() => callback),
}));

describe("WorkOS callback", () => {
  beforeEach(() => callback.mockClear());

  test("rejects malformed callback requests without invoking AuthKit", async () => {
    const { GET } = await import("../../src/app/api/auth/workos/callback/route");
    const response = await GET(new NextRequest("http://localhost/api/auth/workos/callback"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid authentication callback" });
    expect(callback).not.toHaveBeenCalled();
  });

  test("delegates valid callback parameters to AuthKit", async () => {
    const { GET } = await import("../../src/app/api/auth/workos/callback/route");
    const request = new NextRequest(
      "http://localhost/api/auth/workos/callback?code=test_code&state=test_state"
    );

    await GET(request);

    expect(callback).toHaveBeenCalledWith(request);
  });
});
