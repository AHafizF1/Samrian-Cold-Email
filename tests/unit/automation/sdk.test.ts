import { Samrian, SamrianError } from "../../../packages/sdk/src";
import { describe, expect, it, vi } from "vitest";

describe("Samrian SDK", () => {
  it("combines caller cancellation with request timeout", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      });
    });
    const client = new Samrian({
      baseUrl: "https://app.test",
      token: "secret",
      fetch: fetcher as typeof fetch,
      signal: controller.signal,
    });

    const request = client.identity.me();
    controller.abort();

    await expect(request).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
  it("validates API responses before returning them", async () => {
    const client = new Samrian({
      baseUrl: "https://samrian.test",
      token: "sam_test",
      fetch: async () => new Response(JSON.stringify({ wrong: true }), { status: 200 }),
    });

    await expect(client.identity.me()).rejects.toBeInstanceOf(SamrianError);
  });

  it.each(["http://127.0.0.1:3000", "https://app.samrian.test"])(
    "uses configured %s base URL",
    async (baseUrl) => {
      const fetch = vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe(`${baseUrl}/api/v1/me`);
        return Response.json({
          data: { credentialId: "key_1", orgId: "org_1", scopes: [] },
          meta: { requestId: "req_1" },
        });
      });
      const client = new Samrian({ baseUrl, token: "sam_test", fetch });

      await client.identity.me();
    }
  );

  it("sends credentials as bearer headers", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sam_test");
      return new Response(
        JSON.stringify({
          data: { credentialId: "key_1", orgId: "org_1", scopes: [] },
          meta: { requestId: "req_1" },
        }),
        { status: 200 }
      );
    });
    const client = new Samrian({ baseUrl: "https://samrian.test", token: "sam_test", fetch });

    await expect(client.identity.me()).resolves.toMatchObject({ orgId: "org_1" });
  });

  it("rejects insecure remote origins before sending credentials", () => {
    expect(() => new Samrian({ baseUrl: "http://app.samrian.test", token: "sam_test" })).toThrow(
      "SAMRIAN_URL"
    );
  });

  it("does not follow redirects with credentials", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.redirect).toBe("manual");
      return new Response(null, {
        status: 302,
        headers: { location: "https://other.test/capture" },
      });
    });
    const client = new Samrian({
      baseUrl: "https://samrian.test",
      token: "sam_test",
      fetch,
    });

    await expect(client.identity.me()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("lists one bounded contact page without auto-collecting", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://samrian.test/api/v1/contacts?limit=2&cursor=next_1");
      return Response.json({
        data: {
          items: [
            {
              id: "contact_1",
              email: "ada@example.com",
              createdAt: "2026-07-13T10:00:00.000Z",
            },
          ],
        },
        meta: { requestId: "req_1", nextCursor: "next_2" },
      });
    });
    const client = new Samrian({ baseUrl: "https://samrian.test", token: "sam_test", fetch });

    await expect(client.contacts.list({ limit: 2, cursor: "next_1" })).resolves.toEqual({
      items: [
        {
          id: "contact_1",
          email: "ada@example.com",
          createdAt: "2026-07-13T10:00:00.000Z",
        },
      ],
      nextCursor: "next_2",
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("iterates contact pages without collecting them", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            items: [
              { id: "contact_1", email: "one@example.com", createdAt: "2026-07-13T10:00:00.000Z" },
            ],
          },
          meta: { requestId: "req_1", nextCursor: "next_1" },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            items: [
              { id: "contact_2", email: "two@example.com", createdAt: "2026-07-13T10:01:00.000Z" },
            ],
          },
          meta: { requestId: "req_2" },
        })
      );
    const client = new Samrian({ baseUrl: "https://samrian.test", token: "sam_test", fetch });

    const ids: string[] = [];
    for await (const contact of client.contacts.iterate({ limit: 1 })) ids.push(contact.id);

    expect(ids).toEqual(["contact_1", "contact_2"]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("gets one contact by encoded id", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://samrian.test/api/v1/contacts/contact%2F1");
      return Response.json({
        data: {
          id: "contact/1",
          email: "ada@example.com",
          createdAt: "2026-07-13T10:00:00.000Z",
        },
        meta: { requestId: "req_1" },
      });
    });
    const client = new Samrian({ baseUrl: "https://samrian.test", token: "sam_test", fetch });

    await expect(client.contacts.get("contact/1")).resolves.toMatchObject({ id: "contact/1" });
  });

  it("retries a rate-limited read and honors Retry-After", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "RATE_LIMITED", message: "Slow down", requestId: "req_1" },
          }),
          {
            status: 429,
            headers: { "Retry-After": "2" },
          }
        )
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { credentialId: "key_1", orgId: "org_1", scopes: [] },
          meta: { requestId: "req_2" },
        })
      );
    const client = new Samrian({
      baseUrl: "https://samrian.test",
      token: "sam_test",
      fetch,
      sleep,
    });

    await expect(client.identity.me()).resolves.toMatchObject({ orgId: "org_1" });
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("identifies SDK version without exposing token outside authorization", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("user-agent")).toBe("@samrian/sdk/0.1.0");
      expect(
        [...headers.entries()].filter(([name]) => name !== "authorization").flat()
      ).not.toContain("sam_test");
      return Response.json({
        data: { credentialId: "key_1", orgId: "org_1", scopes: [] },
        meta: { requestId: "req_1" },
      });
    });
    const client = new Samrian({ baseUrl: "https://samrian.test", token: "sam_test", fetch });

    await client.identity.me();
  });

  it("propagates injected request and correlation ids", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("x-request-id")).toBe("req_fixed");
      expect(headers.get("x-correlation-id")).toBe("corr_fixed");
      return Response.json({
        data: { credentialId: "key_1", orgId: "org_1", scopes: [] },
        meta: { requestId: "req_fixed" },
      });
    });
    const client = new Samrian({
      baseUrl: "https://samrian.test",
      token: "sam_test",
      fetch,
      createId: () => "req_fixed",
      correlationId: "corr_fixed",
    });

    await client.identity.me();
  });

  it("uses injected clock for HTTP-date retry delay", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "RATE_LIMITED", message: "Slow down", requestId: "req_1" },
          }),
          { status: 429, headers: { "Retry-After": "Tue, 14 Jul 2026 10:00:02 GMT" } }
        )
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { credentialId: "key_1", orgId: "org_1", scopes: [] },
          meta: { requestId: "req_2" },
        })
      );
    const client = new Samrian({
      baseUrl: "https://samrian.test",
      token: "sam_test",
      fetch,
      sleep,
      now: () => Date.parse("Tue, 14 Jul 2026 10:00:00 GMT"),
    });

    await client.identity.me();
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("sends contact import with idempotency key and no unsafe retry", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("idempotency-key")).toBe("import_1");
      expect(JSON.parse(String(init?.body))).toEqual({ contacts: [{ email: "ada@example.com" }] });
      return Response.json({ data: importResult, meta: { requestId: "req_1" } });
    });
    const client = new Samrian({ baseUrl: "https://samrian.test", token: "sam_test", fetch });

    await expect(
      client.contacts.import(
        { contacts: [{ email: "ada@example.com" }] },
        { idempotencyKey: "import_1" }
      )
    ).resolves.toEqual(importResult);
  });

  it("exposes every registered read capability", () => {
    const client = new Samrian({ baseUrl: "https://samrian.test", token: "sam_test" });

    expect(typeof client.groups.list).toBe("function");
    expect(typeof client.groups.preview).toBe("function");
    expect(typeof client.groups.create).toBe("function");
    expect(typeof client.groups.update).toBe("function");
    expect(typeof client.campaigns.list).toBe("function");
    expect(typeof client.campaigns.stats).toBe("function");
    expect(typeof client.campaigns.launch).toBe("function");
    expect(typeof client.campaigns.create).toBe("function");
    expect(typeof client.campaigns.update).toBe("function");
    expect(typeof client.mailboxes.list).toBe("function");
    expect(typeof client.mailboxes.check).toBe("function");
    expect(typeof client.inbox.list).toBe("function");
    expect(typeof client.inbox.get).toBe("function");
    expect(typeof client.inbox.reply).toBe("function");
    expect(typeof client.analytics.org).toBe("function");
    expect(typeof client.analytics.campaign).toBe("function");
    expect(typeof client.contacts.update).toBe("function");
    expect(typeof client.blocklist.list).toBe("function");
    expect(typeof client.blocklist.add).toBe("function");
    expect(typeof client.blocklist.remove).toBe("function");
    expect(typeof client.domains.get).toBe("function");
    expect(typeof client.domains.check).toBe("function");
  });
});

const importResult = {
  created: 1,
  updated: 0,
  skipped: 0,
  duplicateRows: 0,
  invalidRows: 0,
  blockedRows: 0,
  hardBouncedRows: 0,
  unverifiableRows: 0,
  errors: [],
  ids: ["contact_1"],
};
