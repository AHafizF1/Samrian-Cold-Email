# Observability

Samrian uses app-owned observability Interfaces and can send telemetry to Better Stack in production. Local OSS and self-host developers can disable vendor telemetry with `OBSERVABILITY_PROVIDER=none`.

Agents must re-check current Better Stack docs through Context7 before implementing observability milestones:

- Context7 library: `/websites/betterstack`
- OpenTelemetry docs: https://betterstack.com/docs/logs/open-telemetry
- Collector docs: https://betterstack.com/docs/logs/collector
- Uptime API docs: https://betterstack.com/docs/uptime/api
- Status page docs: https://betterstack.com/docs/uptime/api/status-pages
- Warehouse/Grafana docs: https://betterstack.com/docs/logs/grafana-visualization

## Features

| Feature                   | What It Does                                                                                                                                               | Current Need                                                                                             | Milestone |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| Log management            | Centralizes structured JSON logs with severity, service, environment, request ID, correlation ID, user/org IDs, route, job, provider, action, and outcome. | Security scans and production incidents need searchable evidence instead of scattered console output.    | M22       |
| Tracing                   | Captures distributed spans across API requests, DB calls, queue jobs, workers, and provider calls.                                                         | A failed send or auth failure must be traceable across request -> job -> provider before security audit. | M22       |
| Metrics                   | Captures counters and gauges for requests, errors, job lag, provider failures, and infrastructure health.                                                  | Uptime and warehouse reporting need numeric signals, not only logs.                                      | M22-M24   |
| Error tracking            | Captures unhandled and handled production errors with stack, route/job context, release, user/org IDs, and correlation IDs.                                | Launch needs actionable errors with ownership and trace links.                                           | M22       |
| Uptime monitoring         | Runs external checks for app, API health, auth/session, unsubscribe, and tracking endpoints.                                                               | Security audit and launch need stable externally monitored service health.                               | M23       |
| Incident management       | Routes failures to on-call users, supports incident creation, acknowledgement, escalation, resolution, timeline, and metadata.                             | Production failures need owner, severity, and workflow.                                                  | M23       |
| On-call                   | Defines who receives alerts and how escalations proceed.                                                                                                   | Critical incidents cannot depend on someone watching logs manually.                                      | M23       |
| Status page               | Publishes customer-facing component health and incident history.                                                                                           | SaaS launch needs public operational communication.                                                      | M23       |
| Infrastructure monitoring | Tracks host, container, Postgres, Redis, worker, and storage health for Docker/VPS, plus managed-provider signals for serverless.                          | Self-host and production operators need resource health and capacity signals.                            | M24       |
| Warehouse                 | Better Stack stores telemetry in a ClickHouse-backed warehouse queryable through SQL/Grafana-compatible tools.                                             | Audit evidence, incident review, and launch-readiness reporting need historical queries.                 | M24       |

## Modes

### Local OSS Mode

Use this for normal local development:

```env
OBSERVABILITY_PROVIDER="none"
```

No Better Stack token, ingest host, monitor ID, or status page ID is required.

### Docker/VPS Mode

Use Better Stack for production self-hosting:

```env
OBSERVABILITY_PROVIDER="betterstack"
OTEL_SERVICE_NAME="samrian-app"
OTEL_SERVICE_VERSION="2026.07.05"
OTEL_DEPLOYMENT_ENVIRONMENT="production"
BETTER_STACK_SOURCE_TOKEN=""
BETTER_STACK_INGESTING_HOST=""
```

M22 decides whether the app sends OTLP directly or through the Better Stack/OpenTelemetry collector. M24 documents host/container/Postgres/Redis/worker telemetry.

### Managed/Serverless Mode

Use Better Stack for app telemetry and uptime checks while managed providers supply their own resource dashboards:

- Vercel or equivalent: app runtime logs and traces.
- Neon/Supabase: Postgres metrics.
- Inngest: job dashboard.
- S3/R2: storage provider metrics.

Samrian still emits app-owned telemetry with one service name and environment.

## Env Reference

| Env                           | Required When | Purpose                                    |
| ----------------------------- | ------------- | ------------------------------------------ |
| `OBSERVABILITY_PROVIDER`      | always        | `none` or `betterstack`.                   |
| `OTEL_SERVICE_NAME`           | Better Stack  | Service name shown in telemetry.           |
| `OTEL_SERVICE_VERSION`        | Better Stack  | Release/build identifier.                  |
| `OTEL_DEPLOYMENT_ENVIRONMENT` | Better Stack  | `development`, `staging`, or `production`. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | optional      | Override direct OTLP endpoint.             |
| `OTEL_EXPORTER_OTLP_HEADERS`  | optional      | Override OTLP headers.                     |
| `BETTER_STACK_SOURCE_TOKEN`   | Better Stack  | Better Stack telemetry source token.       |
| `BETTER_STACK_INGESTING_HOST` | Better Stack  | Better Stack telemetry ingest host.        |
| `BETTER_STACK_UPTIME_TOKEN`   | M23           | Better Stack Uptime API token.             |
| `BETTER_STACK_TEAM_NAME`      | M23           | Uptime/incidents team routing.             |
| `BETTER_STACK_STATUS_PAGE_ID` | M23           | Status page resource ID.                   |
| `BETTER_STACK_REGION`         | optional      | Region note for docs/operators.            |

Do not commit real values. Store secrets in deployment secret storage.

## Architecture

- App modules use app-owned logging/tracing/error Interfaces.
- Better Stack-specific code lives only under observability adapters, scripts, and tests.
- Config lives in `src/server/observability/config.ts`.
- M21 created config/docs only.
- M22 adds logs, traces, error tracking, redaction, and correlation IDs.
- M23 adds uptime, incidents, on-call, and status page.
- M24 adds infrastructure monitoring and warehouse queries.

## M22 Logs, Traces, Errors

M22 emits structured JSON logs and OpenTelemetry traces through app-owned Interfaces:

- `Logger`: writes one JSON object per event.
- `Tracer`: wraps request/job/provider work in spans.
- `ErrorReporter`: records handled failures with redacted context.
- `ObservabilityContext`: carries `requestId`, `correlationId`, `traceId`, `spanId`, `userId`, `orgId`, `route`, `jobName`, `provider`, `action`, `outcome`, and `durationMs`.

Required log fields for production events:

```json
{
  "time": "2026-07-05T00:00:00.000Z",
  "level": "info",
  "service": "samrian-app",
  "version": "2026.07.05",
  "environment": "production",
  "event": "campaign.send",
  "requestId": "req_...",
  "correlationId": "corr_...",
  "orgId": "org_...",
  "jobName": "campaign.send",
  "provider": "google",
  "outcome": "ok",
  "durationMs": 123
}
```

Secrets must never be logged. Redaction covers auth headers, cookies, OAuth tokens, SMTP/IMAP passwords, WorkOS keys, Better Auth secrets, Better Stack tokens, DB/Redis/S3 URLs, unsubscribe tokens, and tracking tokens.

### Direct OTLP Mode

Direct app export uses Better Stack OpenTelemetry endpoints:

- logs: `https://$BETTER_STACK_INGESTING_HOST/v1/logs`
- traces: `https://$BETTER_STACK_INGESTING_HOST/v1/traces`
- auth: `Authorization: Bearer $BETTER_STACK_SOURCE_TOKEN`

Use direct mode for managed/serverless deployments where running a collector is unnecessary.

### Collector Mode

Docker/VPS operators may run the Better Stack/OpenTelemetry collector and point app OTLP output to the local collector. The collector forwards to Better Stack with `otlphttp/betterstack`.

Use collector mode when host/container/Postgres/Redis metrics are also being collected, or when local buffering/retry is needed.

### Verification

For a failed campaign send, verify:

- API/request log has `requestId` and `correlationId`.
- queue/job log keeps same `correlationId` when available.
- worker failure log has `jobName=campaign.send`, `provider`, `orgId`, and `outcome=error`.
- error record contains stack and redacted metadata.
- Better Stack trace view shows `/v1/traces` data for the request/job span.
- Better Stack log search can filter by `correlationId`.

## Security Audit Dependency

Run security audit after M21 foundation is configured. Run authenticated API authorization and fuzzing after M22 when log and trace evidence is required. Every scanner run should include a run ID that appears in logs as request metadata where practical.

## M23 Uptime, Incidents, On-call, Status Page

M23 uses one app-owned alert manifest for Better Stack Uptime monitors, status page components, and incident severity policy.

### Uptime monitors

Planned monitors:

- `GET /`
- `GET /api/health`, expecting status `200` and keyword `"status":"ok"`
- `GET /api/auth/session`, expecting no server error
- `GET /api/unsubscribe`, expecting safe `400`
- `GET /api/track/click/missing`, expecting safe `404`
- `GET /api/track/open/missing`, expecting safe `404`

Run dry-run setup:

```bash
bun run ops:betterstack
```

Apply with Better Stack Uptime API:

```bash
bun run ops:betterstack:apply
```

Status page component sync requires `BETTER_STACK_STATUS_PAGE_ID` and `--status-page`.

Official docs:

- Uptime API: https://betterstack.com/docs/uptime/api
- Status page API: https://betterstack.com/docs/uptime/api/status-pages

### Incident workflow

Use `docs/INCIDENTS.md` for severity, on-call, acknowledge, escalate, resolve, status update, and maintenance templates.

Incident metadata should include `environment`, `service`, `route`, `jobName`, `orgId`, `traceId`, and `correlationId` when available.

## M24 Infrastructure Monitoring And Warehouse

M24 uses the Better Stack collector and provider-native dashboards for infrastructure monitoring. Samrian does not install a custom collector, create a warehouse client, or make app runtime depend on warehouse SQL.

### Docker/VPS Infrastructure monitoring

Use the Better Stack collector for host and container telemetry. Official docs: https://betterstack.com/docs/logs/collector

Required signals:

- host: CPU, memory, disk, network.
- app container: CPU, memory, restarts, HTTP latency.
- worker container: CPU, memory, restarts, job lag.
- Postgres: health, connections, latency, storage.
- Redis: health, memory, latency, queue pressure.
- storage: availability, latency, capacity.

### Managed/serverless monitoring

Use Better Stack for app logs/traces/errors/uptime and use provider-native dashboards for managed infra:

- Vercel/runtime: runtime errors, request latency, deploy health.
- Neon/Supabase Postgres: connection pressure, query latency, storage.
- Inngest: job failures, retries, queue lag.
- S3/R2: availability, error rate, latency.

### Warehouse

Better Stack warehouse is operational evidence, not app runtime dependency. It is useful for launch review, security audit evidence, and incident review.

Warehouse/Grafana docs: https://betterstack.com/docs/logs/grafana-visualization

Use warehouse queries for:

- error rate
- slow routes
- send failures
- provider failures
- auth failures
- queue lag
- scan-time 4xx/5xx
