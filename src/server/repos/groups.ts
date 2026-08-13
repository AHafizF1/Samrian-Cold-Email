import { and, eq } from "drizzle-orm";

import { contactGroups } from "../db/schema";
import { matchContactGroup, validateGroupRules, type GroupRule } from "../modules/groups";
import type { DbExecutor } from "../db/tx";
import type { OrgId } from "../ports";
import { PostgresContactRepo } from "./contacts";
import { newId } from "./ids";

export type ContactGroupRecord = {
  id: string;
  orgId: OrgId;
  name: string;
  rules: unknown;
  logic: "AND" | "OR";
  isDynamic: boolean;
  contactIds?: string[];
};

export type CreateContactGroupInput = Omit<ContactGroupRecord, "id"> & {
  createdBy: string;
  description?: string;
};

export type UpdateContactGroupInput = {
  name?: string;
  rules?: unknown;
  logic?: "AND" | "OR";
  isDynamic?: boolean;
  contactIds?: string[];
  description?: string | null;
};

const GROUP_SCAN_LIMIT = 10000;

export class PostgresGroupRepo {
  constructor(private readonly db: DbExecutor) {}

  async create(input: CreateContactGroupInput): Promise<ContactGroupRecord> {
    validateGroupInput(input);
    const [row] = await this.db
      .insert(contactGroups)
      .values({
        id: newId("group"),
        orgId: input.orgId,
        name: input.name,
        description: input.description,
        rules: input.rules,
        logic: input.logic,
        isDynamic: input.isDynamic,
        contactIds: input.contactIds,
        createdBy: input.createdBy,
      })
      .returning();
    return toGroup(row);
  }

  async update(
    id: string,
    orgId: OrgId,
    input: UpdateContactGroupInput
  ): Promise<ContactGroupRecord | null> {
    validateGroupInput({
      rules: input.rules ?? [],
      logic: input.logic ?? "AND",
      isDynamic: input.isDynamic ?? false,
    });

    const [row] = await this.db
      .update(contactGroups)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.rules !== undefined ? { rules: input.rules } : {}),
        ...(input.logic !== undefined ? { logic: input.logic } : {}),
        ...(input.isDynamic !== undefined ? { isDynamic: input.isDynamic } : {}),
        ...(input.contactIds !== undefined ? { contactIds: input.contactIds } : {}),
      })
      .where(and(eq(contactGroups.id, id), eq(contactGroups.orgId, orgId)))
      .returning();
    return row ? toGroup(row) : null;
  }

  async getById(id: string, orgId: OrgId): Promise<ContactGroupRecord | null> {
    const [row] = await this.db
      .select()
      .from(contactGroups)
      .where(and(eq(contactGroups.id, id), eq(contactGroups.orgId, orgId)))
      .limit(1);
    return row ? toGroup(row) : null;
  }

  async list(orgId: OrgId, limit = 50): Promise<ContactGroupRecord[]> {
    const rows = await this.db
      .select()
      .from(contactGroups)
      .where(eq(contactGroups.orgId, orgId))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map(toGroup);
  }

  async countContacts(id: string, orgId: OrgId): Promise<number> {
    return (await this.resolveContactIds(id, orgId, GROUP_SCAN_LIMIT)).length;
  }

  async sampleContacts(id: string, orgId: OrgId, limit = 10) {
    const ids = await this.resolveContactIds(id, orgId, limit);
    return new PostgresContactRepo(this.db).listByIds(ids, orgId);
  }

  async resolveContactIds(id: string, orgId: OrgId, limit = GROUP_SCAN_LIMIT): Promise<string[]> {
    const group = await this.getById(id, orgId);
    if (!group) return [];
    if (!group.isDynamic) return (group.contactIds ?? []).slice(0, limit);

    const contacts = await new PostgresContactRepo(this.db).list(orgId, GROUP_SCAN_LIMIT);
    return matchContactGroup(
      contacts,
      {
        logic: group.logic,
        rules: toRules(group.rules),
      },
      { limit }
    ).map((contact) => contact.id);
  }
}

function validateGroupInput(input: Pick<ContactGroupRecord, "isDynamic" | "rules" | "logic">) {
  if (!input.isDynamic) return;
  const errors = validateGroupRules(toRules(input.rules));
  if (errors.length > 0) throw new Error(errors.join("; "));
}

function toRules(rules: unknown): GroupRule[] {
  return Array.isArray(rules) ? (rules as GroupRule[]) : [];
}

function toGroup(row: typeof contactGroups.$inferSelect): ContactGroupRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    rules: row.rules,
    logic: row.logic,
    isDynamic: row.isDynamic,
    contactIds: Array.isArray(row.contactIds) ? row.contactIds.map(String) : undefined,
  };
}
