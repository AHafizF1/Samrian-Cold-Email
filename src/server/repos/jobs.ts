import { decryptCredential as decrypt } from "../crypto";
import { getConnector } from "../../../lib/email-connectors/factory";
import { TokenRefreshError } from "../../../lib/email-connectors/errors";
import type {
  DecryptedCredentials,
  MailboxRecord as ConnectorMailbox,
} from "../../../lib/email-connectors/types";
import type { DbClient, DbExecutor } from "../db/tx";
import { withTenant } from "../db/tenant";
import type { MailboxRecord, NotificationRepo } from "../ports";
import type { ConnectorFactory, JobRepos } from "../jobs/types";
import { notifyMailboxDisconnected } from "../modules/notifications";
import { PostgresAssignmentRepo } from "./assignments";
import { PostgresBlocklistRepo } from "./blocklist";
import { PostgresCampaignRepo } from "./campaigns";
import { PostgresContactRepo } from "./contacts";
import { PostgresEventRepo } from "./events";
import { PostgresMailboxRepo } from "./mailboxes";
import { PostgresNotificationRepo } from "./notifications";
import { PostgresThreadRepo } from "./threads";

export function createPostgresJobRepos(db: DbExecutor): JobRepos {
  return {
    campaigns: new PostgresCampaignRepo(db),
    contacts: new PostgresContactRepo(db),
    mailboxes: new PostgresMailboxRepo(db),
    assignments: new PostgresAssignmentRepo(db),
    blocklist: new PostgresBlocklistRepo(db),
    threads: new PostgresThreadRepo(db),
    notifications: new PostgresNotificationRepo(db),
    events: new PostgresEventRepo(db),
  };
}

export function createPostgresConnectorFactory(
  db: DbExecutor,
  notifications?: NotificationRepo
): ConnectorFactory {
  const mailboxes = new PostgresMailboxRepo(db);

  return async (mailbox: MailboxRecord) => {
    const row = await mailboxes.getRawById(mailbox.id, mailbox.orgId);
    if (!row) throw new Error(`Mailbox ${mailbox.id} not found`);

    const connectorMailbox: ConnectorMailbox = {
      id: row.id,
      provider: row.provider,
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      imapHost: row.imapHost,
      imapPort: row.imapPort,
      username: row.username,
      userEmail: row.userEmail,
    };
    const connector = await getConnector(connectorMailbox, decryptMailbox(row));

    try {
      await connector.getFreshAccessToken();
      await mailboxes.recordTokenRefreshSuccess(row.id, row.orgId, Date.now());
    } catch (error) {
      if (error instanceof TokenRefreshError) {
        await mailboxes.recordTokenRefreshFailure(row.id, row.orgId, error.message, Date.now());
        await notifyMailboxDisconnected(notifications, {
          orgId: row.orgId,
          mailboxId: row.id,
          email: row.userEmail ?? mailbox.email,
        });
      }
      throw error;
    }

    return connector;
  };
}

export function createTenantConnectorFactory(
  db: DbClient,
  actor: { actorType: "request" | "worker"; userId?: string } = { actorType: "worker" }
): ConnectorFactory {
  return async (mailbox: MailboxRecord) => {
    const context = { orgId: mailbox.orgId, ...actor };
    const row = await withTenant(db, context, (tx) =>
      new PostgresMailboxRepo(tx).getRawById(mailbox.id, mailbox.orgId)
    );
    if (!row) throw new Error(`Mailbox ${mailbox.id} not found`);

    const connector = await getConnector(
      {
        id: row.id,
        provider: row.provider,
        smtpHost: row.smtpHost,
        smtpPort: row.smtpPort,
        imapHost: row.imapHost,
        imapPort: row.imapPort,
        username: row.username,
        userEmail: row.userEmail,
      },
      decryptMailbox(row)
    );

    try {
      await connector.getFreshAccessToken();
      await withTenant(db, context, (tx) =>
        new PostgresMailboxRepo(tx).recordTokenRefreshSuccess(row.id, row.orgId, Date.now())
      );
    } catch (error) {
      if (error instanceof TokenRefreshError) {
        await withTenant(db, context, async (tx) => {
          const mailboxes = new PostgresMailboxRepo(tx);
          await mailboxes.recordTokenRefreshFailure(row.id, row.orgId, error.message, Date.now());
          await notifyMailboxDisconnected(new PostgresNotificationRepo(tx), {
            orgId: row.orgId,
            mailboxId: row.id,
            email: row.userEmail ?? mailbox.email,
          });
        });
      }
      await connector.close().catch(() => undefined);
      throw error;
    }

    return connector;
  };
}

function decryptMailbox(
  row: Awaited<ReturnType<PostgresMailboxRepo["getRawById"]>>
): DecryptedCredentials {
  if (!row) throw new Error("Mailbox not found");

  if (row.provider === "google" || row.provider === "microsoft") {
    if (!row.encryptedRefreshToken) {
      throw new Error(`Missing OAuth refresh token for mailbox ${row.id}`);
    }

    return {
      type: "oauth2",
      refreshToken: decrypt(row.encryptedRefreshToken, {
        orgId: row.orgId,
        mailboxId: row.id,
        provider: row.provider,
        purpose: "refresh-token",
      }),
      accessToken: row.encryptedAccessToken
        ? decrypt(row.encryptedAccessToken, {
            orgId: row.orgId,
            mailboxId: row.id,
            provider: row.provider,
            purpose: "access-token",
          })
        : undefined,
      tokenExpiresAt: row.tokenExpiresAt?.getTime(),
    };
  }

  if (!row.encryptedPassword) {
    throw new Error(`Missing SMTP/IMAP password for mailbox ${row.id}`);
  }

  return {
    type: "smtp-imap",
    password: decrypt(row.encryptedPassword, {
      orgId: row.orgId,
      mailboxId: row.id,
      provider: row.provider,
      purpose: "password",
    }),
  };
}
