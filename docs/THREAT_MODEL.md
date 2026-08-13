# Samrian Threat Model

## Overview

Samrian is a multi-tenant cold-email outreach platform. It manages organizations, users, API
keys, contacts, groups, campaigns, mailbox credentials, campaign assignments, sending schedules,
email threads, replies, bounces, suppressions, notifications, and analytics.

Primary runtime:

- Next.js application and versioned `/api/v1` automation API.
- Better Auth or WorkOS authentication.
- PostgreSQL through Drizzle repositories.
- PostgreSQL row-level security for tenant isolation.
- Inngest or BullMQ/Redis workers.
- Gmail, Microsoft Graph, or SMTP/IMAP mailbox connectors.
- S3-compatible object storage.
- CLI and local stdio MCP clients through the automation API.
- Better Stack-compatible OpenTelemetry logs and traces.

Primary security objectives:

- One organization must never read or mutate another organization's data.
- Identity, organization, role, and scope must come from trusted authentication state.
- Mailbox credentials, API keys, sessions, encryption keys, and provider tokens must remain
  confidential.
- Campaign state transitions and email sends must remain idempotent under retries and concurrency.
- Blocked, unsubscribed, replied, or hard-bounced contacts must not receive later campaign sends.
- Public tracking and unsubscribe endpoints must not become tenant-discovery, redirect, injection,
  or resource-exhaustion surfaces.
- Email, contact, and MCP-returned content must remain untrusted data rather than executable
  instructions.
- Security-critical actions must remain attributable through audit records and correlated telemetry.

Primary runtime code lives under `src/`, `lib/`, `inngest/`, and `packages/`. Tests, docs,
development scripts, scanner configuration, and disposable fixtures are supporting surfaces unless
they handle credentials, production deployment, package publication, or privileged automation.

## Threat Model, Trust Boundaries, and Assumptions

### Actors

Trusted or partially trusted actors:

- Organization owner: controls organization settings, keys, mailboxes, campaigns, and members.
- Organization admin: performs delegated organization operations.
- Organization member: has intentionally narrower application permissions.
- System operator: configures deployment secrets, database roles, providers, and observability.
- Worker runtime: performs queued sending, polling, bounce, health, and maintenance work.
- Better Auth or WorkOS: supplies authenticated identity, organization, and session state.
- Gmail, Microsoft, SMTP/IMAP, S3, Inngest, Redis, and Better Stack: external service dependencies.

Potential attackers:

- Anonymous internet client targeting public routes, auth, OAuth, health, tracking, or unsubscribe.
- Authenticated low-privilege member attempting role or tenant escalation.
- Malicious organization owner attempting cross-tenant access or infrastructure abuse.
- Holder of a leaked, expired, revoked, or over-scoped API key.
- Malicious contact sending crafted headers, MIME, HTML, auto-replies, or DSN content.
- MCP host or model influenced by prompt injection inside contact or inbox content.
- Attacker controlling a configured URL, redirect, storage endpoint, or verifier endpoint.
- Compromised mailbox/provider account.
- Compromised worker, dependency, package, CI environment, or deployment secret.

### Trust Boundaries

#### Browser To Next.js

Browser requests, cookies, route parameters, query parameters, bodies, forwarded headers, and
client-rendered state are untrusted. Session authentication, organization access, permissions,
validation, CSRF posture, origin policy, and response shaping must execute server-side.

Relevant controls include `src/server/auth/`, `src/server/api/session-route.ts`, route schemas, and
security headers.

#### Machine Client To Automation API

CLI, MCP, scripts, and integrations authenticate with organization-owned API keys through
`Authorization: Bearer`. Request-supplied organization identifiers, user identifiers, roles,
scopes, client kinds, and plan tiers are untrusted.

Relevant controls include `src/server/auth/machine.ts`, provider adapters,
`src/server/api/route.ts`, `@samrian/contracts`, idempotency, weighted limits, and bounded
pagination.

#### Auth Provider To App Authorization

Better Auth and WorkOS are authentication adapters. Samrian must normalize their sessions into one
app-owned context. Provider claims remain subject to issuer, session, organization-membership,
role, permission, expiry, and revocation checks. Routes and Modules must not branch directly on
provider SDK behavior.

#### Application To PostgreSQL

Application authorization and PostgreSQL RLS jointly protect tenant data. App and worker runtime
roles must be non-owner, non-superuser, and lack `BYPASSRLS`. Tenant context must be transaction
local. Pooled connections must not retain prior tenant context.

Relevant controls include `src/server/db/tenant.ts`, runtime-role migrations, repository org
filters, ownership checks, and RLS tests.

#### Application To Workers And Queues

Queued payloads cross a delayed, retryable boundary. They can be duplicated, reordered, stale,
forged by a compromised producer, or executed after related state changes. Workers must reload
authoritative state, enforce org boundaries, use expected-step/idempotency guards, respect mailbox
capacity, and avoid trusting payload state beyond stable identifiers.

Relevant controls include `src/server/jobs/`, `src/server/queue/`, `src/server/worker/`, and job
ports.

#### Application To Email Providers

OAuth tokens, SMTP/IMAP passwords, mailbox state, provider thread identifiers, email headers, and
provider errors cross an external boundary. Provider calls can timeout, partially succeed, rate
limit, or return attacker-influenced email content.

Credentials must remain encrypted and provider-specific behavior must stay inside connector
adapters. Database transactions must not remain open during network calls.

#### Public Email Links To Application

Tracking and unsubscribe tokens are bearer capabilities delivered through email. Tokens and
redirect targets must be validated from stored state. Requests are anonymous, highly replayable,
and commonly generated by bots, scanners, proxies, and privacy systems.

#### Application To Storage And Observability

S3 endpoints and object keys cross an external storage boundary. Logs, traces, errors, and incident
systems receive security-sensitive metadata. Neither channel may receive credentials, raw
authorization headers, raw MIME, unsubscribe tokens, tracking tokens, or connection URLs.

#### Local Host To CLI And MCP

CLI and stdio MCP inherit environment credentials from the local host. Process arguments, shell
history, config files, stdout, stderr, protocol output, and child-process environments are distinct
leak paths. MCP tool arguments and returned contact/inbox data are untrusted.

Remote MCP is outside current production scope and must remain disabled until its separate OAuth
and transport milestone passes security gates.

### Input Ownership

Attacker-controlled inputs:

- Public route parameters, headers, cookies, bodies, and query strings.
- API payloads, idempotency keys, cursors, import files, custom variables, templates, and filters.
- Contact data and inbound email headers, MIME parts, text, HTML, DSNs, and auto-replies.
- Tracking and unsubscribe requests.
- MCP prompts, tool arguments, and content returned from Samrian records.

Operator-controlled inputs:

- Environment variables, database URLs, provider endpoints, OAuth configuration, rate-limit mode,
  storage settings, queue settings, and observability destinations.
- Better Stack monitors, WorkOS tenant configuration, and database runtime roles.

Developer-controlled inputs:

- Dependencies, lockfiles, migrations, Docker images, CI workflows, scanner rules, build scripts,
  package publication, and source changes.

### Assumptions

- Deployment secrets are supplied through an appropriate secret manager and are not committed.
- TLS terminates at a trusted platform or reverse proxy.
- Forwarded client-IP headers are trusted only when a configured proxy overwrites them.
- Better Auth and WorkOS provider accounts are securely administered.
- Runtime database credentials use least-privilege roles, not migration-owner credentials.
- Worker and app environments are separated where their database privileges differ.
- Real sending is disabled in disposable security environments.
- Local MCP clients receive separate least-privilege API keys.

Out of scope without separate approval:

- Physical compromise of an operator device.
- Compromise of Better Auth, WorkOS, Gmail, Microsoft, AWS, Cloudflare, or another provider's
  internal infrastructure.
- Remote MCP transport, because current MCP is stdio only.
- Social engineering that does not exploit Samrian software or configuration.

## Attack Surface, Mitigations, and Attacker Stories

### Authentication, Sessions, and Organization Authorization

Relevant attacks:

- Session fixation, cookie theft, CSRF, open redirects, OAuth state substitution, expired-session
  reuse, role escalation, and organization switching.
- Better Auth and WorkOS behavior divergence creating a weaker provider mode.

Mitigations:

- App-owned auth Interface and session helpers.
- Server-side active-organization and membership checks.
- Stable wrong-org not-found behavior.
- Signed OAuth state with cookie, time, user, and organization binding.
- Auth and OAuth rate limits.

Critical invariant: request data cannot select authenticated user, organization, role, or
permission.

### Tenant Isolation and Database Authorization

Relevant attacks:

- IDOR, missing organization predicates, cross-org joins, mass-assigned org IDs, connection-pool
  context leakage, app role using owner credentials, or worker privilege reaching auth data.

Mitigations:

- Module authorization, repository org scoping, ownership checks, RLS, forced RLS, transaction-local
  tenant context, separate app/worker roles, and two-organization tests.

Critical invariant: both app checks and database policy reject cross-tenant reads and writes.

### Automation API and API Keys

Relevant attacks:

- Credential leakage, scope bypass, wrong-org key use, revoked-key reuse, pagination exhaustion,
  idempotency confusion, mass assignment, and creating many keys to bypass per-key limits.

Mitigations:

- Official Better Auth and WorkOS key adapters.
- App-owned normalized principal and scope policy.
- Per-credential plus per-organization limits.
- Versioned schemas, bounded pages, stable errors, and idempotency records.
- Tokens excluded from argv, URLs, logs, traces, and persisted CLI config.

### Campaign Launch, Dispatch, and Sending

Relevant attacks and failures:

- Launching an unready campaign, duplicate assignments, double sends, stale jobs, blocked-contact
  sends, mailbox overuse, queue flooding, and provider partial-success ambiguity.

Mitigations:

- Atomic launch materialization.
- Assignment uniqueness and expected-step guards.
- Queue idempotency.
- Due-state dispatcher.
- Mailbox health, daily capacity, ramp policy, backpressure, and send-time rechecks.
- Provider success required before sent-thread persistence.

### Inbound Email and Inbox

Relevant attacks:

- Crafted DSNs counted as replies, auto-replies stopping campaigns, duplicate inbound side effects,
  malicious HTML, header injection, oversized MIME, and acknowledgement before persistence.

Mitigations:

- Pure inbound and bounce classifiers.
- Idempotent message IDs.
- Process-before-ack behavior.
- Text-first display.
- Thread and organization ownership checks.

Inbound content remains untrusted when shown in UI, CLI, or MCP.

### Tracking and Unsubscribe

Relevant attacks:

- Forged token, token enumeration, open redirect, duplicate events, bot inflation, CSRF-like
  unsubscribe behavior, and resource exhaustion.

Mitigations:

- Signed or stored opaque tokens.
- Stored redirect destination.
- Idempotent events.
- Anonymous endpoint rate limits.
- Tracking disabled by default for cold-email mode.

### Provider, Storage, and Network Requests

Relevant attacks:

- SSRF through configurable endpoints, redirects to private networks, credential disclosure in
  provider errors, malicious object keys, and long external calls inside database transactions.

Mitigations:

- Provider adapters.
- Validated environment configuration.
- Short database transactions around network operations.
- Private storage by default.
- Structured provider error classification and redaction.

Operator-configured endpoints remain security sensitive even when not exposed to normal members.

### CLI and MCP

Relevant attacks:

- Token exposure in process arguments or logs, ambiguous output, autonomous high-impact action,
  prompt injection, repeated tool loops, cancellation leaks, and protocol corruption.

Mitigations:

- Environment token only.
- SDK-only access.
- Stable scopes and contracts.
- Read-only MCP default.
- High-impact tools absent.
- Bounded results.
- Local concurrency and identical-call guards.
- MCP stdout reserved for JSON-RPC.

### Dependencies, Deployment, and Observability

Relevant attacks:

- Dependency compromise, vulnerable container, committed secret, unsafe Compose default, migration
  role used at runtime, log injection, secret leakage, and missing incident evidence.

Mitigations:

- Bun lockfile.
- Gitleaks, Semgrep, Trivy, dependency scanning, production build, Docker config validation,
  structured logging, recursive redaction, health checks, and incident runbooks.

## Severity Calibration

### Critical

Use Critical when exploitation can cross the primary trust boundary with broad irreversible impact.

Examples:

- Anonymous or ordinary member access to arbitrary organizations' mailbox credentials or sessions.
- Remote code execution in app or worker runtime.
- Runtime database role can bypass all RLS and retrieve every tenant's secrets.
- Unauthenticated direct-send path capable of large-scale email abuse.
- Master encryption key or production provider credentials exposed through public response.

### High

Use High for reliable compromise of one or more tenants, privileged actions, or significant email
abuse without broad platform takeover.

Examples:

- Cross-organization campaign, contact, inbox, or API-key access.
- OAuth state substitution attaching an attacker's mailbox to a victim organization.
- Stored inbox content executing script in an authenticated operator's browser.
- API-key scope bypass enabling launch or inbox reply.
- Queue manipulation causing duplicate or unauthorized sends.
- SSRF reaching cloud metadata or internal credential services.

### Medium

Use Medium for bounded compromise requiring meaningful prerequisites, availability degradation, or
security-control weakness without demonstrated tenant escape.

Examples:

- Rate-limit bypass causing expensive provider checks for one organization.
- CSRF on a reversible, lower-impact organization setting.
- Excessive error detail exposing internal implementation but no credential.
- Resource exhaustion bounded to one worker or tenant.
- Missing audit event for a sensitive but otherwise authorized action.

### Low

Use Low for defense-in-depth gaps with limited realistic impact.

Examples:

- Missing non-critical security header with no compatible exploit path.
- Minor version disclosure.
- Harmless log-field inconsistency after redaction.
- Operator-only unsafe default clearly documented and unreachable from tenant users.

Severity must follow demonstrated reachability, prerequisites, controls, blast radius, and
counterevidence. Scanner labels alone do not establish severity.
