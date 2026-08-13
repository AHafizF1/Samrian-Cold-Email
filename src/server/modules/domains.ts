import { checkDomain } from "../deliverability/dns";
import type { DomainCheckResult } from "../deliverability/dns";
import type { OrgId } from "../ports";

export type DomainDeps = {
  domains: {
    get(orgId: OrgId, domain: string): Promise<DomainCheckResult | null>;
    upsert(input: DomainCheckResult & { orgId: OrgId }): Promise<void>;
  };
  now?: () => number;
};

const STALE_AFTER_MS = 5 * 60 * 60 * 1000;

export function normalizeDomain(value: string) {
  const domain = value.trim().toLowerCase();
  return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain) ? domain : null;
}

export async function getDomainReadiness(
  input: { orgId: OrgId; domain: string },
  deps: DomainDeps
) {
  const now = deps.now?.() ?? Date.now();
  const cached = await deps.domains.get(input.orgId, input.domain);
  if (cached && now - cached.checkedAt < STALE_AFTER_MS) {
    return { ...cached, cached: true };
  }

  const checked = await checkDomain(input.domain);
  await deps.domains.upsert({ ...checked, orgId: input.orgId });
  return { ...checked, cached: false };
}
