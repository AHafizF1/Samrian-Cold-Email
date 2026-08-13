import { describe, expect, test } from "vitest";

import {
  assessContact,
  extractDomain,
  importContacts,
  normalizeEmail,
  previewContacts,
  validateEmail,
} from "../../../src/server/modules/contacts";
import type { ContactRecord } from "../../../src/server/ports";

describe("contact hygiene module", () => {
  test("previews import quality without writing contacts", async () => {
    const write = async () => {
      throw new Error("preview attempted write");
    };
    const result = await previewContacts(
      { orgId: "org_1", rows: [{ email: "new@example.com" }, { email: "bad" }] },
      {
        contacts: {
          getByEmail: async () => null,
          create: write,
          update: write,
        },
        blocklist: { isBlocked: async () => false },
      }
    );

    expect(result).toMatchObject({ created: 1, invalidRows: 1, skipped: 1, ids: [] });
  });

  test("normalizes email and extracts domain", () => {
    expect(normalizeEmail(" Ada@Example.COM ")).toBe("ada@example.com");
    expect(extractDomain("ada@example.com")).toBe("example.com");
  });

  test("validates email syntax and domain", () => {
    expect(validateEmail("ada@example.com")).toEqual({ ok: true });
    expect(validateEmail("not-an-email")).toMatchObject({ ok: false, reason: "invalid-syntax" });
    expect(validateEmail("ada@localhost")).toMatchObject({ ok: false, reason: "invalid-domain" });
  });

  test("assesses blocked, hard-bounced, invalid, and warning-only verification states", async () => {
    const eligible: ContactRecord = {
      id: "contact_1",
      orgId: "org_1",
      email: "ada@example.com",
      customVars: {},
      verificationStatus: "risky",
    };
    await expect(assessContact(eligible, { isBlocked: async () => false })).resolves.toMatchObject({
      status: "eligible",
      warnings: ["verification:risky"],
    });
    await expect(
      assessContact(
        { ...eligible, email: "bad", verificationStatus: undefined },
        { isBlocked: async () => false }
      )
    ).resolves.toMatchObject({ status: "invalid" });
    await expect(assessContact(eligible, { isBlocked: async () => true })).resolves.toMatchObject({
      status: "blocked",
    });
    await expect(
      assessContact({ ...eligible, bounceStatus: "hard" }, { isBlocked: async () => false })
    ).resolves.toMatchObject({ status: "hard-bounced" });
    await expect(
      assessContact(
        { ...eligible, verificationStatus: "invalid" },
        { isBlocked: async () => false }
      )
    ).resolves.toMatchObject({ status: "invalid" });
  });

  test("imports contacts with row-level quality report", async () => {
    const store: ContactRecord[] = [
      { id: "contact_existing", orgId: "org_1", email: "existing@example.com", customVars: {} },
      {
        id: "contact_bounced",
        orgId: "org_1",
        email: "bounced@example.com",
        customVars: {},
        bounceStatus: "hard",
      },
    ];
    let nextId = 1;

    const result = await importContacts(
      {
        orgId: "org_1",
        rows: [
          { email: "New@Example.com", customVars: { firstName: "New" } },
          { email: "new@example.com" },
          { email: "bad" },
          { email: "blocked@example.com" },
          { email: "existing@example.com", timezone: "UTC" },
          { email: "bounced@example.com" },
          { email: "risky@example.com" },
        ],
      },
      {
        contacts: {
          async getByEmail(email) {
            return store.find((contact) => contact.email === email) ?? null;
          },
          async create(input) {
            const contact = {
              id: `contact_${nextId++}`,
              orgId: input.orgId,
              email: input.email,
              customVars: input.customVars ?? {},
              timezone: input.timezone,
              verificationStatus: input.verification?.status,
              verificationReason: input.verification?.reason,
              verificationProvider: input.verification?.provider,
              verificationCheckedAt: input.verification?.checkedAt,
            };
            store.push(contact);
            return contact;
          },
          async update(id, _orgId, input) {
            const contact = store.find((item) => item.id === id);
            if (!contact) return null;
            Object.assign(contact, input);
            return contact;
          },
        },
        blocklist: {
          async isBlocked(email) {
            return email === "blocked@example.com";
          },
        },
        verifier: {
          async verify(email) {
            return email === "risky@example.com"
              ? { status: "risky", reason: "catch-all", provider: "fake", checkedAt: 1 }
              : { status: "valid", provider: "fake", checkedAt: 1 };
          },
        },
      }
    );

    expect(result).toMatchObject({
      created: 2,
      updated: 1,
      duplicateRows: 1,
      invalidRows: 1,
      blockedRows: 1,
      hardBouncedRows: 1,
      unverifiableRows: 1,
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { index: 1, email: "new@example.com", reason: "duplicate-row" },
        { index: 2, email: "bad", reason: "invalid-syntax" },
      ])
    );
  });
});
