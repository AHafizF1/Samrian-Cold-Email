export type InfraTarget = {
  name: string;
  mode: "docker-vps";
  signals: string[];
};

export type ManagedSource = {
  name: string;
  mode: "managed";
  signals: string[];
};

export type WarehouseSql = {
  name: string;
  purpose: string;
  sql: string;
};

export const DOCKER_MONITORING_TARGETS: InfraTarget[] = [
  {
    name: "host",
    mode: "docker-vps",
    signals: ["cpu", "memory", "disk", "network"],
  },
  {
    name: "app-container",
    mode: "docker-vps",
    signals: ["cpu", "memory", "restarts", "http-latency"],
  },
  {
    name: "worker-container",
    mode: "docker-vps",
    signals: ["cpu", "memory", "restarts", "job-lag"],
  },
  {
    name: "postgres",
    mode: "docker-vps",
    signals: ["health", "connections", "latency", "storage"],
  },
  {
    name: "redis",
    mode: "docker-vps",
    signals: ["health", "memory", "latency", "queue-pressure"],
  },
  {
    name: "storage",
    mode: "docker-vps",
    signals: ["health", "availability", "latency", "capacity"],
  },
];

export const MANAGED_MONITORING_SOURCES: ManagedSource[] = [
  {
    name: "vercel-runtime",
    mode: "managed",
    signals: ["runtime-errors", "request-latency", "deploy-health"],
  },
  {
    name: "neon-or-supabase-postgres",
    mode: "managed",
    signals: ["connection-pressure", "query-latency", "storage"],
  },
  {
    name: "inngest",
    mode: "managed",
    signals: ["job-failures", "retries", "queue-lag"],
  },
  {
    name: "s3-or-r2",
    mode: "managed",
    signals: ["availability", "error-rate", "latency"],
  },
];

export const WAREHOUSE_QUERIES: WarehouseSql[] = [
  {
    name: "error-rate",
    purpose: "launch and incident review",
    sql: "SELECT service, countIf(level = 'error') AS errors, count() AS total FROM logs WHERE time >= now() - INTERVAL 1 HOUR GROUP BY service",
  },
  {
    name: "slow-routes",
    purpose: "launch and incident review",
    sql: "SELECT route, quantile(0.95)(durationMs) AS p95_ms FROM logs WHERE route != '' GROUP BY route ORDER BY p95_ms DESC LIMIT 20",
  },
  {
    name: "send-failures",
    purpose: "launch and security audit evidence",
    sql: "SELECT orgId, provider, count() AS failures FROM logs WHERE event IN ('error.captured', 'job.failed') AND jobName = 'campaign.send' GROUP BY orgId, provider",
  },
  {
    name: "provider-failures",
    purpose: "incident review",
    sql: "SELECT provider, outcome, count() AS total FROM logs WHERE provider != '' AND level IN ('warn', 'error') GROUP BY provider, outcome",
  },
  {
    name: "auth-failures",
    purpose: "security audit evidence",
    sql: "SELECT route, count() AS failures FROM logs WHERE route LIKE '%auth%' AND level IN ('warn', 'error') GROUP BY route",
  },
  {
    name: "queue-lag",
    purpose: "launch and incident review",
    sql: "SELECT jobName, quantile(0.95)(durationMs) AS p95_ms FROM logs WHERE event = 'job.end' GROUP BY jobName ORDER BY p95_ms DESC",
  },
  {
    name: "scan-time-4xx-5xx",
    purpose: "security audit evidence",
    sql: "SELECT route, status, count() AS total FROM logs WHERE status >= 400 GROUP BY route, status ORDER BY total DESC",
  },
];
