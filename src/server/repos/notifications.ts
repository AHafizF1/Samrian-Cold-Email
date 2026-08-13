import { and, count, desc, eq, isNull } from "drizzle-orm";

import { notifications } from "../db/schema";
import type { DbExecutor } from "../db/tx";
import type {
  CountUnreadNotificationsInput,
  CreateNotificationInput,
  ListNotificationsInput,
  NotificationId,
  NotificationRecord,
  OrgId,
} from "../ports";
import { newId } from "./ids";

export class PostgresNotificationRepo {
  constructor(private readonly db: DbExecutor) {}

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const [row] = await this.db
      .insert(notifications)
      .values({
        id: newId("notification"),
        orgId: input.orgId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data,
      })
      .returning();
    return toNotification(row);
  }

  async getById(id: NotificationId, orgId: OrgId): Promise<NotificationRecord | null> {
    const [row] = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.orgId, orgId)))
      .limit(1);
    return row ? toNotification(row) : null;
  }

  async listLatest(input: ListNotificationsInput): Promise<NotificationRecord[]> {
    const filters = [eq(notifications.orgId, input.orgId)];
    if (input.userId) filters.push(eq(notifications.userId, input.userId));

    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(...filters))
      .orderBy(desc(notifications.createdAt))
      .limit(input.limit);

    return rows.map(toNotification);
  }

  async countUnread(input: CountUnreadNotificationsInput): Promise<number> {
    const filters = [eq(notifications.orgId, input.orgId), isNull(notifications.readAt)];
    if (input.userId) filters.push(eq(notifications.userId, input.userId));

    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(and(...filters));
    return row?.value ?? 0;
  }

  async markRead(id: NotificationId, orgId: OrgId, at = new Date()): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: at })
      .where(and(eq(notifications.id, id), eq(notifications.orgId, orgId)));
  }

  async markAllRead(input: CountUnreadNotificationsInput, at = new Date()): Promise<number> {
    const filters = [eq(notifications.orgId, input.orgId), isNull(notifications.readAt)];
    if (input.userId) filters.push(eq(notifications.userId, input.userId));

    const rows = await this.db
      .update(notifications)
      .set({ readAt: at })
      .where(and(...filters))
      .returning();

    return rows.length;
  }
}

function toNotification(row: typeof notifications.$inferSelect): NotificationRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId ?? undefined,
    type: row.type,
    title: row.title,
    body: row.body ?? undefined,
    data: (row.data as Record<string, unknown> | null) ?? undefined,
    readAt: row.readAt?.getTime(),
    createdAt: row.createdAt.getTime(),
  };
}
