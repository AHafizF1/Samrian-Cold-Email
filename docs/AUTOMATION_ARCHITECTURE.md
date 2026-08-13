# Automation Architecture

## Boundary

```text
CLI -> SDK -> /api/v1 -> auth/policy -> domain modules -> repos/jobs
```

The CLI, future MCP server, and external integrations only call the versioned
HTTP API through `@samrian/sdk`. They never import Next.js route handlers,
Drizzle, repositories, job queues, mail connectors, Better Auth, or WorkOS.

## Credentials

`MachineCredential` normalizes Better Auth and WorkOS API keys into one
`AutomationPrincipal` with organization ID, credential ID, optional user ID,
and canonical scopes. The authenticated credential establishes organization
identity. Request payloads never choose it.

- Better Auth uses its official API-key plugin with organization-owned keys and
  `enableSessionForAPIKeys: false`.
- WorkOS uses organization-owned AuthKit API keys through its official API-key
  API.
- WorkOS administrators must add every canonical scope from
  `@samrian/contracts` to **Authorization > Configuration > Organization API
  key permissions**. Roles that create keys also need
  `widgets:api-keys:manage`. See [WorkOS API Keys](https://workos.com/docs/authkit/api-keys)
  and [API reference](https://workos.com/docs/reference/authkit/api-keys).
- Better Auth revocation disables a key and is reversible. Installed official
  WorkOS SDK revocation deletes a key and is irreversible. Samrian returns this
  difference as `reversible` instead of pretending providers behave alike.
- Key values are accepted only in `Authorization: Bearer <key>`.
- Key values must never appear in URLs, process arguments, persisted CLI
  configuration, logs, traces, responses after creation, or errors.

## Capability Policy

CLI may expose scoped high-impact operations with explicit confirmation. Future
MCP stays read and draft-safe until its own security gate passes. Neither
surface can send mail directly: launch goes through campaign readiness,
dispatcher, queue, and send workflows.

MCP uses the same SDK over stdio. `read-only` exposes read-risk operations;
`operator` adds only operations marked MCP-safe in the canonical registry.
Mode filters tool discovery but never grants API scopes. Streamable HTTP and
OAuth remain disabled until remote transport receives its security review.

## Versioning

Public automation routes live below `/api/v1`. Existing `/api/*` routes are
internal application routes and are not public-contract guarantees. Every v1
operation is declared in `packages/contracts/src/index.ts` with scopes, risk,
idempotency policy, and MCP allowance.

## Domain Ownership

Versioned routes own HTTP auth, schemas, transactions, and response mapping.
Domain Modules own reusable business policy. Repositories own bounded database
queries and writes. A route may call a repository directly for query intent
that has no reusable domain behavior; adding a pass-through Module would make
the Interface shallower, not deeper.

Credential lifecycle and use are recorded through structured events:
`credential.created`, `credential.used`, `credential.denied`,
`credential.rejected`, and `credential.revoked`. Rejection covers invalid,
expired, or provider-revoked credentials without leaking which condition
matched. Provider metadata plus these events satisfy M25 audit needs, so no
duplicate credential-reference table is added.
