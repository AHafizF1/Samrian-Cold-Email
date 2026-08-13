type DataProtectionEnv = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "postgres", "redis", "minio"]);

export function auditDataProtection(env: DataProtectionEnv) {
  const issues: string[] = [];

  requireHttps(env.NEXT_PUBLIC_APP_URL, "NEXT_PUBLIC_APP_URL", issues);
  for (const name of [
    "APP_DATABASE_URL",
    "AUTH_DATABASE_URL",
    "WORKER_DATABASE_URL",
    "DATABASE_URL",
  ] as const) {
    requirePostgresTls(env[name], name, issues);
  }
  if (env.JOB_PROVIDER === "bullmq") {
    requireTlsProtocol(env.REDIS_URL, "REDIS_URL", "rediss:", issues);
  }
  requireHttps(env.S3_ENDPOINT, "S3_ENDPOINT", issues);
  if (env.OBSERVABILITY_PROVIDER === "betterstack") {
    requireHttps(env.OTEL_EXPORTER_OTLP_ENDPOINT, "OTEL_EXPORTER_OTLP_ENDPOINT", issues);
  }

  return { ok: issues.length === 0, issues };
}

function requirePostgresTls(value: string | undefined, name: string, issues: string[]) {
  if (!value) return;
  const url = parse(value, name, issues);
  if (!url || LOCAL_HOSTS.has(url.hostname)) return;
  if (!["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")) {
    issues.push(`${name} must require TLS`);
  }
}

function requireHttps(value: string | undefined, name: string, issues: string[]) {
  if (!value) return;
  const url = parse(value, name, issues);
  if (!url || LOCAL_HOSTS.has(url.hostname)) return;
  if (url.protocol !== "https:") issues.push(`${name} must use HTTPS`);
}

function requireTlsProtocol(
  value: string | undefined,
  name: string,
  protocol: string,
  issues: string[]
) {
  if (!value) return;
  const url = parse(value, name, issues);
  if (!url || LOCAL_HOSTS.has(url.hostname)) return;
  if (url.protocol !== protocol) issues.push(`${name} must use ${protocol.replace(":", "")}`);
}

function parse(value: string, name: string, issues: string[]) {
  try {
    return new URL(value);
  } catch {
    issues.push(`${name} must be a valid URL`);
    return null;
  }
}
