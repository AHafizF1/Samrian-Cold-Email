import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresMailboxRepo } from "@/server/repos";

export const GET = createSessionRoute(sessionOperations.mailboxList, async ({ orgId, db }) => {
  const mailboxes = await new PostgresMailboxRepo(db).listItems(orgId);
  return NextResponse.json({ mailboxes });
});
