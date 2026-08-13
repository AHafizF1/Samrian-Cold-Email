import { and, asc, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  createCredentialCrypto,
  credentialKeyId,
  getCredentialKeys,
  type CredentialContext,
} from "../../src/server/crypto";
import { rotateCredential } from "../../src/server/crypto/rotate";
import * as schema from "../../src/server/db/schema";
import { mailboxes } from "../../src/server/db/schema";

type MailboxSecretRow = {
  id: string;
  orgId: string;
  provider: CredentialContext["provider"];
  encryptedPassword?: string | null;
  encryptedRefreshToken?: string | null;
  encryptedAccessToken?: string | null;
};

type RotationDeps = {
  activeKeyId: string;
  crypto: ReturnType<typeof createCredentialCrypto>;
  list(cursor: string | undefined, limit: number): Promise<MailboxSecretRow[]>;
  update(
    id: string,
    patch: Partial<
      Pick<MailboxSecretRow, "encryptedPassword" | "encryptedRefreshToken" | "encryptedAccessToken">
    >
  ): Promise<void>;
};

export async function runCredentialRotation(args: string[], deps: RotationDeps) {
  const options = parseArgs(args);
  const rows = await deps.list(options.cursor, options.limit);
  let failed = 0;
  let rotated = 0;
  let stale = 0;

  for (const row of rows) {
    try {
      const patch: Record<string, string> = {};
      for (const field of secretFields) {
        const value = row[field.column];
        if (!value || credentialKeyId(value) === deps.activeKeyId) continue;
        stale += 1;
        if (!options.apply) continue;
        patch[field.column] = rotateCredential(
          value,
          {
            orgId: row.orgId,
            mailboxId: row.id,
            provider: row.provider,
            purpose: field.purpose,
          },
          deps.activeKeyId,
          deps.crypto
        ).value;
      }
      if (options.apply && Object.keys(patch).length > 0) {
        await deps.update(row.id, patch);
        rotated += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    apply: options.apply,
    failed,
    nextCursor: rows.at(-1)?.id,
    rotated,
    scanned: rows.length,
    stale,
  };
}

const secretFields = [
  { column: "encryptedPassword", purpose: "password" },
  { column: "encryptedRefreshToken", purpose: "refresh-token" },
  { column: "encryptedAccessToken", purpose: "access-token" },
] as const;

function parseArgs(args: string[]) {
  const apply = args.includes("--apply");
  const cursor = readArg(args, "--cursor");
  const limitValue = readArg(args, "--limit");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("--limit must be between 1 and 500");
  }
  return { apply, cursor, limit };
}

function readArg(args: string[], name: string) {
  const prefixed = args.find((arg) => arg.startsWith(`${name}=`));
  if (prefixed) return prefixed.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const keyConfig = getCredentialKeys();
  const sql = postgres(url, { connect_timeout: 5, idle_timeout: 1, max: 1 });
  const db = drizzle(sql, { schema });
  try {
    const result = await runCredentialRotation(process.argv.slice(2), {
      activeKeyId: keyConfig.activeKeyId,
      crypto: createCredentialCrypto(keyConfig),
      list: async (cursor, limit) =>
        db
          .select({
            id: mailboxes.id,
            orgId: mailboxes.orgId,
            provider: mailboxes.provider,
            encryptedPassword: mailboxes.encryptedPassword,
            encryptedRefreshToken: mailboxes.encryptedRefreshToken,
            encryptedAccessToken: mailboxes.encryptedAccessToken,
          })
          .from(mailboxes)
          .where(cursor ? gt(mailboxes.id, cursor) : undefined)
          .orderBy(asc(mailboxes.id))
          .limit(limit),
      update: async (id, patch) => {
        await db
          .update(mailboxes)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(mailboxes.id, id)));
      },
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1]?.endsWith("rotate.ts")) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Credential rotation failed"}\n`
    );
    process.exitCode = 1;
  });
}
