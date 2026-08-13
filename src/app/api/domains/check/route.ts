import { NextRequest, NextResponse } from "next/server";

import { createSessionAction } from "../../../../server/api/session-route";
import { sessionOperations } from "../../../../server/auth/policy";
import { getDomainReadiness } from "../../../../server/modules/domains";
import { createDomainPort } from "../../../../server/repos";

export const GET = createSessionAction(
  sessionOperations.domainCheck,
  async ({ orgId, tenant }, request: NextRequest) => {
    const domain = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase();

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 });
    }

    const readiness = await getDomainReadiness(
      { orgId, domain },
      { domains: createDomainPort(tenant) }
    );

    return NextResponse.json(readiness);
  },
  { operationId: "domains.check" }
);
