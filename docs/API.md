# Automation API

Samrian exposes machine access under `/api/v1`. OpenAPI is available at
`GET /api/v1/openapi.json`.

## Authentication

Send organization-owned API keys as `Authorization: Bearer <key>`. Never put keys in URLs,
request bodies, CLI arguments, logs, or config files. Better Auth and WorkOS keys map to the same
Samrian scopes.

## Requests

- JSON request bodies reject unknown fields.
- Lists default to 50 items and accept at most 100.
- Contact pagination uses opaque `nextCursor` values.
- `Idempotency-Key` is required for creates, imports, campaign launches, and inbox replies.
- Reusing a key with a different body returns `IDEMPOTENCY_CONFLICT`.

## Responses

```json
{
  "data": {},
  "meta": { "requestId": "req_...", "nextCursor": "optional" }
}
```

Errors use stable codes and include the same request ID. Wrong-organization resources return the
same `NOT_FOUND` response as missing resources.

`X-Request-Id` and `X-Correlation-Id` are accepted and returned. SDK creates
both when absent and preserves them across safe retries.

## Safety

No public operation sends an arbitrary email, writes mailbox credentials, manages organization
members, or accesses queue internals. Campaign delivery always uses launch, dispatcher, queue, and
send Modules. MCP availability is declared by the operation registry and excludes launch, reply,
and blocklist mutation.

## CLI

Set `SAMRIAN_URL` and `SAMRIAN_TOKEN`, then run `samrian auth whoami`. CLI stores no token. JSON is
default for non-TTY output; operational errors go to stderr.

Generate shell completion with `samrian completion powershell`,
`samrian completion bash`, or `samrian completion zsh`. Same CLI contract works
against local/self-hosted and hosted URLs through `SAMRIAN_URL`.
