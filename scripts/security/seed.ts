import { and, eq } from "drizzle-orm";
import { scopePresets } from "@samrian/contracts";

import { createDb } from "../../src/server/db/db";
import {
  blocklist,
  campaigns,
  contacts,
  contactAssignments,
  contactGroups,
  mailboxes,
  members,
  notifications,
  organizations,
  orgSettings,
  threads,
  users,
} from "../../src/server/db/schema";

const FIXTURES = {
  orgA: { id: "sec_org_a", name: "Security Org A", slug: "security-org-a" },
  orgB: { id: "sec_org_b", name: "Security Org B", slug: "security-org-b" },
} as const;

const ROLES = ["owner", "admin", "member"] as const;

export function assertDisposableDatabase(url: string | undefined, marker: string | undefined) {
  if (!url || marker !== "I_UNDERSTAND_THIS_DATA_IS_DISPOSABLE") {
    throw new Error("SECURITY_DISPOSABLE marker and DATABASE_URL are required");
  }
  const database = new URL(url).pathname.slice(1);
  if (!database.includes("security"))
    throw new Error("Security seed requires a database named with 'security'");
}

export async function seedSecurityData(env = process.env) {
  assertDisposableDatabase(env.DATABASE_URL, env.SECURITY_DISPOSABLE);
  // Seeding is an explicit disposable-environment admin operation. Runtime app,
  // auth, and worker containers never receive this migration-owner credential.
  const db = createDb({ driver: "postgres-js", url: env.DATABASE_URL! }).client;
  const password = requireValue(env, "SECURITY_AUTH_PASSWORD");
  const baseUrl = requireValue(env, "SECURITY_APP_URL").replace(/\/$/, "");
  const createdKeys: Record<string, Record<string, string | null>> = {};

  for (const org of [FIXTURES.orgA, FIXTURES.orgB]) {
    await db.insert(organizations).values(org).onConflictDoNothing({ target: organizations.id });
    for (const role of ROLES) {
      const email = `${role}-${org.slug}@security.test`;
      const user = await ensureUser(db, baseUrl, email, password);
      await db
        .insert(members)
        .values({
          id: `${org.id}_${role}_member`,
          organizationId: org.id,
          userId: user.id,
          role,
        })
        .onConflictDoNothing();
    }

    const contactId = `${org.id}_contact`;
    const campaignId = `${org.id}_campaign`;
    const mailboxId = `${org.id}_mailbox`;
    await db
      .insert(contacts)
      .values({
        id: contactId,
        orgId: org.id,
        email: `contact@${org.slug}.test`,
        domain: `${org.slug}.test`,
      })
      .onConflictDoNothing();
    await db
      .insert(contactGroups)
      .values({
        id: `${org.id}_group`,
        orgId: org.id,
        name: "Security Static Group",
        rules: [],
        logic: "AND",
        isDynamic: false,
        contactIds: [contactId],
        createdBy: "security-seed",
      })
      .onConflictDoNothing();
    await db
      .insert(campaigns)
      .values({
        id: campaignId,
        orgId: org.id,
        name: "Security Draft Campaign",
        status: "draft",
        schedule: {
          timezone: "UTC",
          startTime: "09:00",
          endTime: "17:00",
          sendDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        },
        steps: [{ subject: "Security fixture", body: "Fixture body" }],
        targetContactIds: [contactId],
      })
      .onConflictDoNothing();
    await db
      .insert(mailboxes)
      .values({
        id: mailboxId,
        orgId: org.id,
        name: "Security Disabled Mailbox",
        provider: "smtp",
        userEmail: `mailbox@${org.slug}.test`,
        dailySendLimit: 1,
        status: "disconnected",
        lastConnectionError: "Security fixture: external connections disabled",
      })
      .onConflictDoNothing();
    await db
      .insert(contactAssignments)
      .values({
        id: `${org.id}_assignment`,
        orgId: org.id,
        campaignId,
        contactId,
        status: "active",
      })
      .onConflictDoNothing();
    await db
      .insert(threads)
      .values({
        id: `${org.id}_thread`,
        orgId: org.id,
        campaignId,
        contactId,
        mailboxId,
        messageId: `<security-${org.id}@example.test>`,
        direction: "received",
        from: `contact@${org.slug}.test`,
        to: [`mailbox@${org.slug}.test`],
        subject: "Security fixture reply",
        textBody: "Untrusted fixture content",
        classification: "reply",
        receivedAt: new Date("2026-01-01T00:00:00.000Z"),
      })
      .onConflictDoNothing();
    await db
      .insert(notifications)
      .values({
        id: `${org.id}_notification`,
        orgId: org.id,
        type: "reply",
        title: "Security fixture notification",
        data: { threadId: `${org.id}_thread` },
      })
      .onConflictDoNothing();
    await db
      .insert(blocklist)
      .values({
        id: `${org.id}_blocklist`,
        orgId: org.id,
        email: `blocked@${org.slug}.test`,
        reason: "manual",
      })
      .onConflictDoNothing();
    await db
      .insert(orgSettings)
      .values({ id: `${org.id}_settings`, orgId: org.id })
      .onConflictDoNothing();

    createdKeys[org.id] = await ensureApiKeys(
      baseUrl,
      org.id,
      `owner-${org.slug}@security.test`,
      password
    );
  }

  const rows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.id, FIXTURES.orgA.id)));
  if (!rows.length) throw new Error("Security seed verification failed");

  return { ...FIXTURES, apiKeys: createdKeys };
}

type Db = ReturnType<typeof createDb>["client"];

async function ensureUser(db: Db, baseUrl: string, email: string, password: string) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) return existing[0];

  const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: new URL(baseUrl).origin },
    body: JSON.stringify({ name: email.split("@")[0], email, password }),
  });
  if (!response.ok) throw new Error(`Could not create security user: ${email}`);

  const created = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!created[0]) throw new Error(`Security user was not persisted: ${email}`);
  return created[0];
}

function requireValue(env: Record<string, string | undefined>, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function ensureApiKeys(baseUrl: string, orgId: string, email: string, password: string) {
  const signIn = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: new URL(baseUrl).origin },
    body: JSON.stringify({ email, password }),
  });
  if (!signIn.ok) throw new Error(`Could not sign in security owner: ${email}`);
  const cookie = signIn.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Better Auth did not return a security seed session cookie");

  const active = await fetch(`${baseUrl}/api/auth/organization/set-active`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: new URL(baseUrl).origin,
    },
    body: JSON.stringify({ organizationId: orgId }),
  });
  if (!active.ok) throw new Error(`Could not activate security organization: ${orgId}`);

  const listed = await fetch(`${baseUrl}/api/settings/api-keys`, { headers: { Cookie: cookie } });
  if (!listed.ok) throw new Error(`Could not list security API keys: ${orgId}`);
  const existing = (await listed.json()) as { name: string }[];
  const result: Record<string, string | null> = {};

  for (const [preset, presetScopes] of Object.entries(scopePresets)) {
    const name = `security-${preset}`;
    if (existing.some((key) => key.name === name)) {
      result[preset] = null;
      continue;
    }
    const response = await fetch(`${baseUrl}/api/settings/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: new URL(baseUrl).origin,
      },
      body: JSON.stringify({ name, scopes: presetScopes }),
    });
    if (!response.ok) throw new Error(`Could not create ${preset} security API key`);
    const key = (await response.json()) as { value: string };
    result[preset] = key.value;
  }

  return result;
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedSecurityData()
    .then((fixtures) => process.stdout.write(`${JSON.stringify(fixtures, null, 2)}\n`))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Security seed failed";
      process.stderr.write(`[X] ${message}\n`);
      process.exit(1);
    });
}
