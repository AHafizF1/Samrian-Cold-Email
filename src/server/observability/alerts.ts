export type MonitorSpec = {
  name: string;
  path: string;
  method: "GET";
  expectedStatus: number;
  keyword?: string;
};

export type StatusComponentSpec = {
  name: string;
  group: "core" | "email" | "data";
};

export type IncidentSeverity = "P1" | "P2" | "P3" | "P4";

export type SeveritySpec = {
  label: string;
  notify: "page" | "alert" | "ticket";
  response: string;
};

export const MONITOR_SPECS: MonitorSpec[] = [
  { name: "Samrian Home", path: "/", method: "GET", expectedStatus: 200 },
  {
    name: "Samrian Health",
    path: "/api/health",
    method: "GET",
    expectedStatus: 200,
    keyword: '"status":"ok"',
  },
  { name: "Samrian Auth Session", path: "/api/auth/session", method: "GET", expectedStatus: 200 },
  { name: "Samrian Unsubscribe", path: "/api/unsubscribe", method: "GET", expectedStatus: 400 },
  {
    name: "Samrian Click Tracking",
    path: "/api/track/click/missing",
    method: "GET",
    expectedStatus: 404,
  },
  {
    name: "Samrian Open Tracking",
    path: "/api/track/open/missing",
    method: "GET",
    expectedStatus: 404,
  },
];

export const STATUS_COMPONENTS: StatusComponentSpec[] = [
  { name: "App", group: "core" },
  { name: "API", group: "core" },
  { name: "Auth", group: "core" },
  { name: "Database", group: "data" },
  { name: "Queue/Workers", group: "data" },
  { name: "Email Sending", group: "email" },
  { name: "Inbox Polling", group: "email" },
  { name: "Tracking", group: "email" },
  { name: "Storage", group: "data" },
];

export const SEVERITY_MAP: Record<IncidentSeverity, SeveritySpec> = {
  P1: {
    label: "Critical",
    notify: "page",
    response: "App down, auth down, sending globally down, or data loss risk.",
  },
  P2: {
    label: "High",
    notify: "alert",
    response: "Degraded sending/polling, DB/queue instability, or high error rate.",
  },
  P3: {
    label: "Medium",
    notify: "ticket",
    response: "Single provider issues or non-critical API degradation.",
  },
  P4: {
    label: "Maintenance",
    notify: "ticket",
    response: "Docs, status, maintenance windows, or low-risk operational work.",
  },
};

export const INCIDENT_METADATA_KEYS = [
  "environment",
  "service",
  "route",
  "jobName",
  "orgId",
  "traceId",
  "correlationId",
] as const;
