import { createUnsubscribeToken } from "../modules/unsubscribe";
import {
  createPostgresJobRepos,
  createTenantConnectorFactory,
  PostgresCampaignMailboxRepo,
  PostgresAuditRepo,
  PostgresEventRepo,
  PostgresMailboxRepo,
  PostgresNotificationRepo,
  PostgresSettingsRepo,
} from "../repos";
import type { WorkerDeps } from "./worker";
import {
  checkMailboxHealth,
  dispatchDueSends,
  evaluateMailboxRamps,
  pollMailbox,
  processBounce,
  resetCounters,
  sendCampaign,
} from "../jobs";
import { getWorkerDb } from "../db/db";
import { withTenant } from "../db/tenant";
import type { DbExecutor } from "../db/tx";
import { createJobQueue } from "../queue";
import type { JobQueue } from "../ports";
import { getLimitGuard } from "../limits";

const BOUNCE_RATE_THRESHOLD = 0.05;

export function createWorkerDeps(queue?: JobQueue) {
  const db = getWorkerDb();
  const getQueue = () => queue ?? createJobQueue();
  const connectorForMailbox = createTenantConnectorFactory(db);

  return {
    sendCampaign: (payload) => {
      const transaction = jobTransaction(db, payload.orgId);
      return sendCampaign(payload, {
        transaction,
        connectorForMailbox,
        generateUnsubscribeToken: async (input) => createUnsubscribeToken(input),
        appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        now: Date.now,
        getComplianceSettings: ({ orgId }) =>
          withTenant(db, { orgId, actorType: "worker" }, (tx) =>
            new PostgresSettingsRepo(tx).getCompliance(orgId)
          ),
        getSendingSettings: (orgId) =>
          withTenant(db, { orgId, actorType: "worker" }, (tx) =>
            new PostgresSettingsRepo(tx).getSending(orgId)
          ),
      });
    },
    pollMailbox: (payload) =>
      pollMailbox(payload, {
        transaction: jobTransaction(db, payload.orgId),
        connectorForMailbox,
        now: Date.now,
      }),
    checkMailboxHealth: (payload) =>
      checkMailboxHealth(payload, {
        transaction: (operation) =>
          withTenant(db, { orgId: payload.orgId, actorType: "worker" }, (tx) =>
            operation({ mailboxes: createPostgresJobRepos(tx).mailboxes })
          ),
        connectorForMailbox,
        now: Date.now,
      }),
    processBounce: (payload) =>
      withTenant(db, { orgId: payload.orgId, actorType: "worker" }, async (tx) =>
        processBounce(payload, {
          repos: createDeps(tx).repos,
          bounceRateThreshold: BOUNCE_RATE_THRESHOLD,
        })
      ),
    resetCounters: () =>
      withTenant(db, { orgId: "system", actorType: "system" }, async (tx) =>
        resetCounters({ repos: createDeps(tx).repos })
      ),
    dispatchDueSends: () =>
      dispatchDueSends({
        queue: getQueue(),
        limits: getLimitGuard(),
        transaction: (operation) =>
          withTenant(db, { orgId: "system", actorType: "system" }, (tx) => {
            const deps = createDeps(tx);
            return operation({
              assignments: deps.repos.assignments,
              campaignMailboxes: deps.campaignMailboxes,
              blocklist: deps.repos.blocklist,
            });
          }),
        now: Date.now,
      }),
    evaluateMailboxRamps: () =>
      evaluateMailboxRamps({
        now: Date.now,
        listDue: (now, limit) =>
          withTenant(db, { orgId: "system", actorType: "system" }, (tx) =>
            new PostgresMailboxRepo(tx).listRampDue(now, limit)
          ),
        transaction: (orgId, operation) =>
          withTenant(db, { orgId, actorType: "worker" }, (tx) => {
            const mailboxes = new PostgresMailboxRepo(tx);
            const events = new PostgresEventRepo(tx);
            return operation({
              getEvidence: (mailboxId, tenantOrgId, since) =>
                events.getMailboxRampEvidence(mailboxId, tenantOrgId, since),
              update: (mailboxId, tenantOrgId, decision, expectedNextCheckAt) =>
                mailboxes.updateRamp(mailboxId, tenantOrgId, decision, expectedNextCheckAt),
              audit: async (input) => {
                await new PostgresAuditRepo(tx).create({
                  orgId: input.orgId,
                  userId: "system",
                  action: "mailbox.ramp_changed",
                  details: JSON.stringify({
                    mailboxId: input.mailboxId,
                    priorStatus: input.priorStatus,
                    status: input.status,
                    priorLimit: input.priorLimit,
                    currentLimit: input.currentLimit,
                    reason: input.reason,
                  }),
                });
              },
              notifications: new PostgresNotificationRepo(tx),
            });
          }),
      }),
    dispatchMailboxPolls: async () => {
      const jobs = getQueue();
      const mailboxes = await listActiveMailboxes(db);
      await Promise.all(
        mailboxes.map((mailbox) =>
          jobs.enqueueMailboxPoll({ mailboxId: mailbox.id, orgId: mailbox.orgId })
        )
      );
      return { status: "dispatched" as const, count: mailboxes.length };
    },
    dispatchMailboxChecks: async () => {
      const jobs = getQueue();
      const mailboxes = await listActiveMailboxes(db);
      await Promise.all(
        mailboxes.map((mailbox) =>
          jobs.enqueueMailboxCheck({ mailboxId: mailbox.id, orgId: mailbox.orgId })
        )
      );
      return { enqueued: mailboxes.length };
    },
  } satisfies WorkerDeps & {
    dispatchMailboxPolls(): Promise<unknown>;
    dispatchMailboxChecks(): Promise<{ enqueued: number }>;
  };
}

function createDeps(db: DbExecutor) {
  const repos = createPostgresJobRepos(db);
  return {
    repos,
    campaignMailboxes: new PostgresCampaignMailboxRepo(db),
    settings: new PostgresSettingsRepo(db),
  };
}

function jobTransaction(db: ReturnType<typeof getWorkerDb>, orgId: string) {
  return <T>(operation: (repos: ReturnType<typeof createPostgresJobRepos>) => Promise<T>) =>
    withTenant(db, { orgId, actorType: "worker" }, (tx) => operation(createPostgresJobRepos(tx)));
}

async function listActiveMailboxes(db: ReturnType<typeof getWorkerDb>) {
  return withTenant(db, { orgId: "system", actorType: "system" }, (tx) =>
    createPostgresJobRepos(tx).mailboxes.listActive()
  );
}
