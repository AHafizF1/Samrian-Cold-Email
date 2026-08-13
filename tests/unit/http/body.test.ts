import { describe, expect, test } from "vitest";

import { boundRequest, readJsonResponse } from "../../../src/server/http/body";

describe("bounded request bodies", () => {
  test("preserves a JSON body within the byte limit", async () => {
    const request = new Request("https://app.example.com/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Campaign" }),
    });

    const bounded = await boundRequest(request, 1024);

    await expect(bounded.json()).resolves.toEqual({ name: "Campaign" });
  });

  test("rejects declared bodies above the limit before reading", async () => {
    const request = new Request("https://app.example.com/api", {
      method: "POST",
      headers: {
        "content-length": "2048",
        "content-type": "application/json",
      },
      body: "{}",
    });

    await expect(boundRequest(request, 1024)).rejects.toMatchObject({
      status: 413,
    });
  });

  test("rejects streamed bodies above the actual byte limit", async () => {
    const request = new Request("https://app.example.com/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "é".repeat(600),
    });

    await expect(boundRequest(request, 1024)).rejects.toMatchObject({
      status: 413,
    });
  });

  test("rejects unsupported content types when a body exists", async () => {
    const request = new Request("https://app.example.com/api", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });

    await expect(boundRequest(request, 1024)).rejects.toMatchObject({
      status: 415,
    });
  });

  test("leaves bodyless requests unchanged", async () => {
    const request = new Request("https://app.example.com/api");

    await expect(boundRequest(request, 1024)).resolves.toBe(request);
  });

  test("rejects excessive JSON nesting before parsing", async () => {
    const body = `${"[".repeat(33)}0${"]".repeat(33)}`;
    const request = new Request("https://app.example.com/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    await expect(boundRequest(request, 1024)).rejects.toMatchObject({ status: 422 });
  });

  test("bounds provider JSON responses before parsing", async () => {
    const response = Response.json({ value: "x".repeat(1024) });

    await expect(readJsonResponse(response, 128)).rejects.toMatchObject({ status: 413 });
  });
});
