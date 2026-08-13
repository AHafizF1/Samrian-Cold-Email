import { NextResponse } from "next/server";

import { createSessionAction, createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { importContacts } from "@/server/modules/contacts";
import { createContactImportDeps, PostgresContactRepo } from "@/server/repos";
import { createEmailVerifier } from "@/server/verify/email";

export const GET = createSessionRoute(
  sessionOperations.contactsList,
  async ({ orgId, db }, request: Request) => {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim();
    const limit = Number(searchParams.get("limit") ?? 50);
    const repo = new PostgresContactRepo(db);
    const contacts = query
      ? await repo.searchItems(orgId, query, limit)
      : await repo.listItems(orgId, limit);

    return NextResponse.json({ contacts, page: contacts });
  }
);

export const POST = createSessionAction(
  sessionOperations.contactImport,
  async ({ orgId, tenant }, request: Request) => {
    const body = (await request.json()) as {
      contacts?: Array<{ email: string; customVars?: Record<string, unknown>; timezone?: string }>;
    };

    if (!body.contacts?.length) {
      return NextResponse.json({ error: "contacts are required" }, { status: 400 });
    }

    const report = await importContacts(
      { orgId, rows: body.contacts },
      createContactImportDeps(tenant, createEmailVerifier())
    );

    return NextResponse.json({
      ...report,
      success: report.ids,
      errors: report.errors.map((error) => ({
        index: error.index,
        error: error.reason,
        email: error.email,
      })),
    });
  },
  { bodyLimitBytes: 2 * 1024 * 1024 }
);

export const PATCH = createSessionRoute(
  sessionOperations.contactsUpdate,
  async ({ orgId, db }, request: Request) => {
    const body = (await request.json()) as { ids?: string[]; timezone?: string };

    if (!body.ids?.length || !body.timezone) {
      return NextResponse.json({ error: "ids and timezone are required" }, { status: 400 });
    }

    const result = await new PostgresContactRepo(db).bulkUpdateTimezone(
      body.ids,
      orgId,
      body.timezone
    );
    return NextResponse.json(result);
  }
);

export const DELETE = createSessionRoute(
  sessionOperations.contactDelete,
  async ({ orgId, db }, request: Request) => {
    const body = (await request.json()) as { ids?: string[] };

    if (!body.ids?.length) {
      return NextResponse.json({ error: "ids are required" }, { status: 400 });
    }

    const result = await new PostgresContactRepo(db).bulkRemove(body.ids, orgId);
    return NextResponse.json(result);
  }
);
