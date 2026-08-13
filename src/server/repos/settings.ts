import { and, eq } from "drizzle-orm";

import { notificationPrefs, orgSettings } from "../db/schema";
import type { DbExecutor } from "../db/tx";
import type { ComplianceSettings } from "../modules/compliance";
import {
  getDefaultNotificationPrefs,
  normalizeNotificationPrefs,
  type NotificationPrefs,
} from "../modules/notification-prefs";
import type { OrgId } from "../ports";
import { newId } from "./ids";

export type ComplianceConfig = ComplianceSettings & {
  defaultSenderName?: string | null;
  bouncePauseRate: number;
  unsubscribePauseRate: number;
  complaintPauseRate: number;
};

export type SendingSettings = {
  defaultRampEnabled: boolean;
  defaultRampTarget: number;
  replyReserve: number;
};

export class PostgresSettingsRepo {
  constructor(private readonly db: DbExecutor) {}

  async getSettings(orgId: OrgId): Promise<ComplianceConfig> {
    return this.getCompliance(orgId);
  }

  async getCompliance(orgId: OrgId): Promise<ComplianceConfig> {
    const [row] = await this.db
      .select()
      .from(orgSettings)
      .where(eq(orgSettings.orgId, orgId))
      .limit(1);

    if (!row) return defaultCompliance();

    return {
      listUnsubscribeEnabled: row.listUnsubscribeEnabled,
      clickTrackingEnabled: row.clickTrackingEnabled,
      openTrackingEnabled: row.openTrackingEnabled,
      physicalAddress: row.physicalAddress,
      defaultSenderName: row.defaultSenderName,
      unsubscribeFooter: row.unsubscribeFooter,
      unsubscribeMailto: row.unsubscribeMailto,
      bouncePauseRate: row.bouncePauseRate,
      unsubscribePauseRate: row.unsubscribePauseRate,
      complaintPauseRate: row.complaintPauseRate,
    };
  }

  async upsertCompliance(orgId: OrgId, input: Partial<ComplianceConfig>): Promise<void> {
    const current = await this.getRaw(orgId);
    const values = {
      physicalAddress: input.physicalAddress,
      defaultSenderName: input.defaultSenderName,
      unsubscribeFooter: input.unsubscribeFooter,
      unsubscribeMailto: input.unsubscribeMailto,
      listUnsubscribeEnabled: input.listUnsubscribeEnabled ?? false,
      clickTrackingEnabled: input.clickTrackingEnabled ?? false,
      openTrackingEnabled: input.openTrackingEnabled ?? false,
      bouncePauseRate: input.bouncePauseRate ?? 0.05,
      unsubscribePauseRate: input.unsubscribePauseRate ?? 0.1,
      complaintPauseRate: input.complaintPauseRate ?? 0.001,
    };

    if (current) {
      await this.db.update(orgSettings).set(values).where(eq(orgSettings.orgId, orgId));
      return;
    }

    await this.db.insert(orgSettings).values({
      id: newId("org_settings"),
      orgId,
      ...values,
    });
  }

  async getSending(orgId: OrgId): Promise<SendingSettings> {
    const row = await this.getRaw(orgId);
    return {
      defaultRampEnabled: row?.defaultRampEnabled ?? false,
      defaultRampTarget: row?.defaultRampTarget ?? 30,
      replyReserve: row?.replyReserve ?? 2,
    };
  }

  async upsertSending(orgId: OrgId, input: SendingSettings): Promise<SendingSettings> {
    const current = await this.getRaw(orgId);
    const values = {
      defaultRampEnabled: input.defaultRampEnabled,
      defaultRampTarget: clamp(input.defaultRampTarget, 5, 100),
      replyReserve: clamp(input.replyReserve, 0, 10),
    };
    if (current) {
      await this.db.update(orgSettings).set(values).where(eq(orgSettings.orgId, orgId));
    } else {
      await this.db.insert(orgSettings).values({
        id: newId("org_settings"),
        orgId,
        ...values,
      });
    }
    return values;
  }

  async getNotificationPrefs(orgId: OrgId, userId: string): Promise<NotificationPrefs> {
    const [row] = await this.db
      .select()
      .from(notificationPrefs)
      .where(and(eq(notificationPrefs.orgId, orgId), eq(notificationPrefs.userId, userId)))
      .limit(1);

    if (!row) return getDefaultNotificationPrefs(orgId, userId);

    return normalizeNotificationPrefs({
      orgId,
      userId,
      replyInAppEnabled: row.replyInAppEnabled,
      replyForwardEnabled: row.replyForwardEnabled,
      replyForwardEmails: asStrings(row.replyForwardEmails),
      browserPushEnabled: row.browserPushEnabled,
    });
  }

  async upsertNotificationPrefs(
    orgId: OrgId,
    userId: string,
    input: Partial<NotificationPrefs>
  ): Promise<NotificationPrefs> {
    const values = normalizeNotificationPrefs({ orgId, userId, ...input });
    const current = await this.getRawNotificationPrefs(orgId, userId);
    const write = {
      replyInAppEnabled: values.replyInAppEnabled,
      replyForwardEnabled: values.replyForwardEnabled,
      replyForwardEmails: values.replyForwardEmails,
      browserPushEnabled: values.browserPushEnabled,
      updatedAt: new Date(),
    };

    if (current) {
      await this.db
        .update(notificationPrefs)
        .set(write)
        .where(and(eq(notificationPrefs.orgId, orgId), eq(notificationPrefs.userId, userId)));
      return values;
    }

    await this.db.insert(notificationPrefs).values({
      id: newId("notification_prefs"),
      orgId,
      userId,
      ...write,
    });
    return values;
  }

  private async getRaw(orgId: OrgId) {
    const [row] = await this.db
      .select()
      .from(orgSettings)
      .where(eq(orgSettings.orgId, orgId))
      .limit(1);
    return row ?? null;
  }

  private async getRawNotificationPrefs(orgId: OrgId, userId: string) {
    const [row] = await this.db
      .select()
      .from(notificationPrefs)
      .where(and(eq(notificationPrefs.orgId, orgId), eq(notificationPrefs.userId, userId)))
      .limit(1);
    return row ?? null;
  }
}

function defaultCompliance(): ComplianceConfig {
  return {
    listUnsubscribeEnabled: false,
    clickTrackingEnabled: false,
    openTrackingEnabled: false,
    bouncePauseRate: 0.05,
    unsubscribePauseRate: 0.1,
    complaintPauseRate: 0.001,
  };
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}
