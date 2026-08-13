import { and, desc, eq, ilike, inArray, lt, or } from "drizzle-orm";

import { contacts } from "../db/schema";
import { extractDomain, normalizeEmail, type ContactImportDeps } from "../modules/contacts";
import type { DbExecutor, DbTransaction } from "../db/tx";
import type { EmailVerificationResult, EmailVerifier } from "../ports";
import type { ContactId, ContactRecord, OrgId } from "../ports";
import { PostgresBlocklistRepo } from "./blocklist";
import { newId } from "./ids";

export type CreateContactInput = {
  orgId: OrgId;
  email: string;
  domain?: string;
  customVars?: Record<string, unknown>;
  timezone?: string;
  verification?: EmailVerificationResult;
};

export type UpdateContactInput = {
  email?: string;
  domain?: string | null;
  customVars?: Record<string, unknown>;
  timezone?: string | null;
  bounceStatus?: string | null;
  verificationStatus?: EmailVerificationResult["status"] | null;
  verificationCheckedAt?: number | null;
  verificationReason?: string | null;
  verificationProvider?: string | null;
};

export function createContactImportDeps(
  tenant: <T>(operation: (db: DbTransaction) => Promise<T>) => Promise<T>,
  verifier?: EmailVerifier
): ContactImportDeps {
  return {
    contacts: {
      getByEmail: (email, orgId) =>
        tenant((db) => new PostgresContactRepo(db).getByEmail(email, orgId)),
      create: (input) => tenant((db) => new PostgresContactRepo(db).create(input)),
      update: (id, orgId, input) =>
        tenant((db) => new PostgresContactRepo(db).update(id, orgId, input)),
    },
    blocklist: {
      isBlocked: (email, orgId) =>
        tenant((db) => new PostgresBlocklistRepo(db).isBlocked(email, orgId)),
    },
    verifier,
  };
}

export type ContactListItem = ContactRecord & {
  _id: ContactId;
  _creationTime: number;
  timezone?: string;
  createdAt: string;
};

export type ContactPageCursor = { createdAt: string; id: string };

export class PostgresContactRepo {
  constructor(private readonly db: DbExecutor) {}

  async create(input: CreateContactInput): Promise<ContactRecord> {
    const email = normalizeEmail(input.email);
    const [row] = await this.db
      .insert(contacts)
      .values({
        id: newId("contact"),
        orgId: input.orgId,
        email,
        domain: input.domain ?? extractDomain(email),
        customVars: input.customVars ?? {},
        timezone: input.timezone,
        verificationStatus: input.verification?.status,
        verificationCheckedAt: input.verification
          ? new Date(input.verification.checkedAt)
          : undefined,
        verificationReason: input.verification?.reason,
        verificationProvider: input.verification?.provider,
      })
      .returning();

    return toContact(row);
  }

  async list(orgId: OrgId, limit = 50): Promise<ContactRecord[]> {
    const rows = await this.db
      .select()
      .from(contacts)
      .where(eq(contacts.orgId, orgId))
      .limit(limit);
    return rows.map(toContact);
  }

  async listItems(orgId: OrgId, limit = 50): Promise<ContactListItem[]> {
    const rows = await this.db
      .select()
      .from(contacts)
      .where(eq(contacts.orgId, orgId))
      .limit(limit);
    return rows.map(toContactItem);
  }

  async listPage(
    orgId: OrgId,
    input: { limit: number; cursor?: ContactPageCursor }
  ): Promise<{ items: ContactListItem[]; nextCursor?: ContactPageCursor }> {
    const cursor = input.cursor;
    const rows = await this.db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.orgId, orgId),
          cursor
            ? or(
                lt(contacts.createdAt, new Date(cursor.createdAt)),
                and(eq(contacts.createdAt, new Date(cursor.createdAt)), lt(contacts.id, cursor.id))
              )
            : undefined
        )
      )
      .orderBy(desc(contacts.createdAt), desc(contacts.id))
      .limit(input.limit + 1);

    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map(toContactItem),
      ...(rows.length > input.limit && last
        ? { nextCursor: { createdAt: last.createdAt.toISOString(), id: last.id } }
        : {}),
    };
  }

  async getItemById(id: ContactId, orgId: OrgId): Promise<ContactListItem | null> {
    const [row] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .limit(1);

    return row ? toContactItem(row) : null;
  }

  async search(orgId: OrgId, query: string, limit = 50): Promise<ContactRecord[]> {
    const rows = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), ilike(contacts.email, `%${query}%`)))
      .limit(limit);
    return rows.map(toContact);
  }

  async searchItems(orgId: OrgId, query: string, limit = 50): Promise<ContactListItem[]> {
    const rows = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), ilike(contacts.email, `%${query}%`)))
      .limit(limit);
    return rows.map(toContactItem);
  }

  async getById(id: ContactId, orgId: OrgId): Promise<ContactRecord | null> {
    const [row] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .limit(1);

    return row ? toContact(row) : null;
  }

  async getByEmail(email: string, orgId: OrgId): Promise<ContactRecord | null> {
    const [row] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.email, normalizeEmail(email))))
      .limit(1);

    return row ? toContact(row) : null;
  }

  async listByIds(ids: ContactId[], orgId: OrgId): Promise<ContactRecord[]> {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return [];

    const rows = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), inArray(contacts.id, uniqueIds)));

    return rows.map(toContact);
  }

  async update(
    id: ContactId,
    orgId: OrgId,
    input: UpdateContactInput
  ): Promise<ContactRecord | null> {
    const [row] = await this.db
      .update(contacts)
      .set({
        ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
        ...(input.domain !== undefined ? { domain: input.domain } : {}),
        ...(input.customVars !== undefined ? { customVars: input.customVars } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.bounceStatus !== undefined ? { bounceStatus: input.bounceStatus } : {}),
        ...(input.verificationStatus !== undefined
          ? { verificationStatus: input.verificationStatus }
          : {}),
        ...(input.verificationCheckedAt !== undefined
          ? {
              verificationCheckedAt: input.verificationCheckedAt
                ? new Date(input.verificationCheckedAt)
                : null,
            }
          : {}),
        ...(input.verificationReason !== undefined
          ? { verificationReason: input.verificationReason }
          : {}),
        ...(input.verificationProvider !== undefined
          ? { verificationProvider: input.verificationProvider }
          : {}),
      })
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .returning();

    return row ? toContact(row) : null;
  }

  async remove(id: ContactId, orgId: OrgId): Promise<boolean> {
    const rows = await this.db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .returning();
    return rows.length > 0;
  }

  async bulkRemove(ids: ContactId[], orgId: OrgId) {
    const success: ContactId[] = [];
    const errors: { id: ContactId; error: string }[] = [];

    for (const id of ids) {
      try {
        if (await this.remove(id, orgId)) success.push(id);
        else errors.push({ id, error: "Contact not found" });
      } catch (error) {
        errors.push({ id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return { success, errors };
  }

  async bulkUpdateTimezone(ids: ContactId[], orgId: OrgId, timezone: string) {
    const success: ContactId[] = [];
    const errors: { id: ContactId; error: string }[] = [];

    for (const id of ids) {
      try {
        const updated = await this.update(id, orgId, { timezone });
        if (updated) success.push(id);
        else errors.push({ id, error: "Contact not found" });
      } catch (error) {
        errors.push({ id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return { success, errors };
  }

  async updateBounceStatus(id: ContactId, orgId: OrgId, status: "hard" | "soft"): Promise<void> {
    await this.update(id, orgId, { bounceStatus: status });
  }
}

function toContact(row: typeof contacts.$inferSelect): ContactRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    email: row.email,
    domain: row.domain ?? undefined,
    customVars: asVars(row.customVars),
    timezone: row.timezone ?? undefined,
    bounceStatus: row.bounceStatus ?? undefined,
    verificationStatus: row.verificationStatus ?? undefined,
    verificationCheckedAt: row.verificationCheckedAt?.getTime(),
    verificationReason: row.verificationReason ?? undefined,
    verificationProvider: row.verificationProvider ?? undefined,
  };
}

function toContactItem(row: typeof contacts.$inferSelect): ContactListItem {
  return {
    ...toContact(row),
    _id: row.id,
    _creationTime: 0,
    createdAt: row.createdAt.toISOString(),
  };
}

function asVars(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
