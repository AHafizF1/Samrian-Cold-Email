import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";

import { campaigns, contactAssignments, contacts } from "../db/schema";
import type {
  AdvanceStepInput,
  AssignmentId,
  AssignmentRecord,
  CampaignId,
  ContactId,
  DispatchAssignmentRecord,
  OrgId,
} from "../ports";
import type { AdvanceStepResult } from "../ports";
import type { DbExecutor } from "../db/tx";
import { newId } from "./ids";

export type CreateAssignmentInput = {
  campaignId: CampaignId;
  contactId: ContactId;
  orgId: OrgId;
  status?: "active" | "replied" | "bounced" | "unsubscribed" | "completed";
  currentStep?: number;
  nextSendAt?: number;
};

export type CreateManyAssignmentsInput = {
  campaignId: CampaignId;
  contactIds: ContactId[];
  orgId: OrgId;
};

export class PostgresAssignmentRepo {
  constructor(private readonly db: DbExecutor) {}

  async create(input: CreateAssignmentInput): Promise<AssignmentRecord> {
    const [row] = await this.db
      .insert(contactAssignments)
      .values({
        id: newId("assignment"),
        campaignId: input.campaignId,
        contactId: input.contactId,
        orgId: input.orgId,
        status: input.status ?? "active",
        currentStep: input.currentStep ?? 0,
        nextSendAt: input.nextSendAt ? new Date(input.nextSendAt) : new Date(),
      })
      .returning();
    return toAssignment(row);
  }

  async createManyForCampaign(input: CreateManyAssignmentsInput): Promise<{
    created: number;
    existing: number;
  }> {
    const contactIds = Array.from(new Set(input.contactIds));
    if (contactIds.length === 0) return { created: 0, existing: 0 };

    const existingRows = await this.db
      .select({ contactId: contactAssignments.contactId })
      .from(contactAssignments)
      .where(
        and(
          eq(contactAssignments.campaignId, input.campaignId),
          eq(contactAssignments.orgId, input.orgId),
          inArray(contactAssignments.contactId, contactIds)
        )
      );
    const existingIds = new Set(existingRows.map((row) => row.contactId));
    const missingIds = contactIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      await this.db.insert(contactAssignments).values(
        missingIds.map((contactId) => ({
          id: newId("assignment"),
          campaignId: input.campaignId,
          contactId,
          orgId: input.orgId,
          status: "active" as const,
          currentStep: 0,
          nextSendAt: new Date(),
        }))
      );
    }

    return { created: missingIds.length, existing: existingIds.size };
  }

  async getById(id: AssignmentId, orgId: OrgId): Promise<AssignmentRecord | null> {
    const [row] = await this.db
      .select()
      .from(contactAssignments)
      .where(and(eq(contactAssignments.id, id), eq(contactAssignments.orgId, orgId)))
      .limit(1);
    return row ? toAssignment(row) : null;
  }

  async getByCampaignAndContact(
    campaignId: CampaignId,
    contactId: ContactId,
    orgId: OrgId
  ): Promise<AssignmentRecord | null> {
    const [row] = await this.db
      .select()
      .from(contactAssignments)
      .where(
        and(
          eq(contactAssignments.campaignId, campaignId),
          eq(contactAssignments.contactId, contactId),
          eq(contactAssignments.orgId, orgId)
        )
      )
      .limit(1);
    return row ? toAssignment(row) : null;
  }

  async listByCampaign(campaignId: CampaignId, orgId: OrgId, limit = 50) {
    const rows = await this.db
      .select()
      .from(contactAssignments)
      .where(
        and(eq(contactAssignments.campaignId, campaignId), eq(contactAssignments.orgId, orgId))
      )
      .limit(limit);

    return rows.map((row) => ({
      _id: row.id,
      campaignId: row.campaignId,
      contactId: row.contactId,
      orgId: row.orgId,
      status: row.status,
      currentStep: row.currentStep,
      lastEmailSentAt: row.lastEmailSentAt?.getTime(),
    }));
  }

  async listByContact(contactId: ContactId, orgId: OrgId, limit = 50) {
    const rows = await this.db
      .select()
      .from(contactAssignments)
      .where(and(eq(contactAssignments.contactId, contactId), eq(contactAssignments.orgId, orgId)))
      .limit(limit);

    return rows.map((row) => ({
      _id: row.id,
      _creationTime: row.createdAt.getTime(),
      campaignId: row.campaignId,
      contactId: row.contactId,
      orgId: row.orgId,
      status: row.status,
      currentStep: row.currentStep,
      lastEmailSentAt: row.lastEmailSentAt?.getTime(),
    }));
  }

  async advanceStep(input: AdvanceStepInput): Promise<AdvanceStepResult> {
    const current = await this.getById(input.id, input.orgId);
    if (!current) return { status: "not-found" };
    if (current.currentStep !== input.expectedStep) {
      return { status: "stale", currentStep: current.currentStep };
    }

    const nextStep = current.currentStep + 1;
    await this.db
      .update(contactAssignments)
      .set({
        currentStep: nextStep,
        assignedMailboxId: input.mailboxId,
        lastEmailSentAt: new Date(input.sentAt),
        nextSendAt: input.nextSendAt ? new Date(input.nextSendAt) : null,
        status: input.completed ? "completed" : "active",
        updatedAt: new Date(),
      })
      .where(and(eq(contactAssignments.id, input.id), eq(contactAssignments.orgId, input.orgId)));

    return { status: "advanced", currentStep: nextStep };
  }

  async updateStatus(id: AssignmentId, orgId: OrgId, status: string): Promise<void> {
    await this.db
      .update(contactAssignments)
      .set({ status: toAssignmentStatus(status), updatedAt: new Date() })
      .where(and(eq(contactAssignments.id, id), eq(contactAssignments.orgId, orgId)));
  }

  async listDueForDispatch(input: {
    now: number;
    limit: number;
  }): Promise<DispatchAssignmentRecord[]> {
    const rows = await this.db
      .select({
        assignment: contactAssignments,
        campaign: campaigns,
        contact: contacts,
      })
      .from(contactAssignments)
      .innerJoin(
        campaigns,
        and(
          eq(campaigns.id, contactAssignments.campaignId),
          eq(campaigns.orgId, contactAssignments.orgId)
        )
      )
      .innerJoin(
        contacts,
        and(
          eq(contacts.id, contactAssignments.contactId),
          eq(contacts.orgId, contactAssignments.orgId)
        )
      )
      .where(
        and(
          eq(contactAssignments.status, "active"),
          eq(campaigns.status, "active"),
          or(
            isNull(contactAssignments.nextSendAt),
            lte(contactAssignments.nextSendAt, new Date(input.now))
          )
        )
      )
      .limit(input.limit);

    return rows.map((row) => ({
      assignmentId: row.assignment.id,
      campaignId: row.assignment.campaignId,
      contactId: row.assignment.contactId,
      orgId: row.assignment.orgId,
      currentStep: row.assignment.currentStep,
      status: row.assignment.status,
      contactEmail: row.contact.email,
      contactTimezone: row.contact.timezone ?? undefined,
      contactBounceStatus: row.contact.bounceStatus ?? undefined,
      contactVerificationStatus: row.contact.verificationStatus ?? undefined,
      campaignStatus: row.campaign.status,
      campaignSchedule: row.campaign.schedule,
      campaignSteps: Array.isArray(row.campaign.steps) ? row.campaign.steps : [],
    }));
  }

  async markEnqueued(id: AssignmentId, orgId: OrgId, at: number): Promise<void> {
    await this.db
      .update(contactAssignments)
      .set({ lastEnqueuedAt: new Date(at), updatedAt: new Date() })
      .where(and(eq(contactAssignments.id, id), eq(contactAssignments.orgId, orgId)));
  }

  async deferUntil(id: AssignmentId, orgId: OrgId, at: number): Promise<void> {
    await this.db
      .update(contactAssignments)
      .set({ nextSendAt: new Date(at), updatedAt: new Date() })
      .where(and(eq(contactAssignments.id, id), eq(contactAssignments.orgId, orgId)));
  }
}

function toAssignment(row: typeof contactAssignments.$inferSelect): AssignmentRecord {
  return {
    id: row.id,
    campaignId: row.campaignId,
    contactId: row.contactId,
    orgId: row.orgId,
    currentStep: row.currentStep,
    status: row.status,
    assignedMailboxId: row.assignedMailboxId ?? undefined,
    lastEmailSentAt: row.lastEmailSentAt?.getTime(),
    nextSendAt: row.nextSendAt?.getTime(),
    lastEnqueuedAt: row.lastEnqueuedAt?.getTime(),
  };
}

function toAssignmentStatus(
  status: string
): "active" | "replied" | "bounced" | "unsubscribed" | "completed" {
  if (
    status === "active" ||
    status === "replied" ||
    status === "bounced" ||
    status === "unsubscribed" ||
    status === "completed"
  ) {
    return status;
  }
  throw new Error(`Invalid assignment status: ${status}`);
}
