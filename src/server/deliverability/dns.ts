import dns from "dns/promises";

export type DnsStatus = "pass" | "warn" | "unknown";

export type DomainCheckResult = {
  domain: string;
  source: "dns";
  status: DnsStatus;
  checks: {
    mx: DnsStatus;
    spf: DnsStatus;
    dmarc: DnsStatus;
    dkim: DnsStatus;
  };
  issues: string[];
  warnings: string[];
  checkedAt: number;
};

export type DnsResolver = {
  resolveMx(domain: string): Promise<Array<{ exchange: string; priority: number }>>;
  resolveTxt(domain: string): Promise<string[][]>;
};

const DKIM_SELECTORS = [
  "google",
  "default",
  "selector1",
  "selector2",
  "key1",
  "key2",
  "key3",
] as const;

export async function checkDomain(
  domain: string,
  resolver: DnsResolver = { resolveMx: dns.resolveMx, resolveTxt: dns.resolveTxt },
  options: { timeoutMs?: number } = {}
): Promise<DomainCheckResult> {
  const bounded = boundResolver(resolver, options.timeoutMs ?? 5_000);
  const [mx, spf, dmarc, dkim] = await Promise.all([
    checkMx(domain, bounded),
    checkTxt(domain, bounded, (value) => value.startsWith("v=spf1")),
    checkTxt(`_dmarc.${domain}`, bounded, (value) => value.startsWith("v=DMARC1")),
    checkDkim(domain, bounded),
  ]);
  const checks = {
    mx,
    spf,
    dmarc,
    dkim,
  };
  const issues: string[] = [];
  const warnings: string[] = [];

  for (const [name, status] of Object.entries(checks)) {
    if (status === "warn") warnings.push(`${name.toUpperCase()} record not found`);
    if (status === "unknown") issues.push(`${name.toUpperCase()} check failed`);
  }

  return {
    domain,
    source: "dns",
    status: Object.values(checks).includes("unknown")
      ? "unknown"
      : Object.values(checks).includes("warn")
        ? "warn"
        : "pass",
    checks,
    issues,
    warnings,
    checkedAt: Date.now(),
  };
}

async function checkMx(domain: string, resolver: DnsResolver): Promise<DnsStatus> {
  try {
    return (await resolver.resolveMx(domain)).length > 0 ? "pass" : "warn";
  } catch {
    return "unknown";
  }
}

async function checkTxt(
  domain: string,
  resolver: DnsResolver,
  predicate: (value: string) => boolean
): Promise<DnsStatus> {
  try {
    const values = (await resolver.resolveTxt(domain)).map((parts) => parts.join(""));
    return values.some(predicate) ? "pass" : "warn";
  } catch {
    return "warn";
  }
}

async function checkDkim(domain: string, resolver: DnsResolver): Promise<DnsStatus> {
  const checks = await Promise.all(
    DKIM_SELECTORS.map((selector) =>
      checkTxt(`${selector}._domainkey.${domain}`, resolver, (value) => value.startsWith("v=DKIM1"))
    )
  );
  return checks.includes("pass") ? "pass" : checks.includes("unknown") ? "unknown" : "warn";
}

function boundResolver(resolver: DnsResolver, timeoutMs: number): DnsResolver {
  return {
    resolveMx: (domain) => deadline(resolver.resolveMx(domain), timeoutMs),
    resolveTxt: (domain) => deadline(resolver.resolveTxt(domain), timeoutMs),
  };
}

async function deadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("DNS lookup timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
