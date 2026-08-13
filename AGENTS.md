# Samrian Agent Guide

Samrian is self-hostable cold-email outreach software built with Next.js 16, PostgreSQL, Drizzle,
Better Auth or WorkOS, Inngest or BullMQ, and S3-compatible storage.

## Read First

1. `README.md`
2. `CONTRIBUTING.md`
3. `docs/DEVELOPMENT.md`
4. `docs/DEPLOYMENT.md`
5. `src/server/db/schema/index.ts`
6. `docs/SECURITY_WORKFLOW.md` for security checks

## Architecture

```text
UI / API routes / workers
  -> server modules and jobs
  -> app-owned ports
  -> repos and provider adapters
```

- UI and routes never import Drizzle, queue clients, or provider SDKs directly.
- Modules own business rules, validation, authorization intent, and state transitions.
- Repos own PostgreSQL mechanics and tenant-scoped data access.
- Provider SDKs stay in auth, connector, queue, storage, and observability adapters.
- Shared handlers serve Inngest and BullMQ.
- `packages/contracts`, `sdk`, `cli`, and `mcp` remain independent from server implementation.

## Security And Data Boundaries

- Use app-owned auth helpers under `src/server/auth`.
- Enforce org ownership without revealing cross-tenant resource existence.
- Use `withTenant` or approved system context for tenant DB work.
- Keep external network calls outside DB transactions.
- Validate every path, query, body, header, webhook, and provider payload at trust boundaries.
- Never log credentials, authorization headers, raw MIME, message bodies, or secrets.
- Keep API v1 behavior behind contracts and domain modules.

## Code Rules

- Read touched flow before editing.
- Write RED test before behavior change.
- Prefer smallest working change.
- Extract shared logic after three real repetitions.
- Use short domain names. Avoid `utils`, `helpers`, `manager`, and broad `service` files.
- Keep comments for non-obvious invariants only.
- Do not modify generated Drizzle metadata manually.
- Do not restore removed Convex code or dependencies.

## Naming

- Files: lowercase kebab-case or established short domain name.
- React components and types: PascalCase.
- Functions and variables: camelCase.
- Constants: UPPER_SNAKE_CASE only for true constants.
- Database tables and columns: lowercase snake_case.

## Tests

Use focused project tests while working:

```powershell
bun run test --project unit
bun run test --project api
bun run test --project components
bun run test:db
```

Final gate:

```powershell
bun run format
bun run validate
bun run test
bun run test:db
bun run build
docker compose config --quiet
```

Docker integration tests need the documented `TEST_*` environment values and local Postgres,
Redis, or MinIO services.

## Git

Use Conventional Commits. Keep commits coherent. Never discard unrelated dirty-worktree changes.
Do not commit `.env.local`, generated reports, build output, local logs, or provider credentials.

## Licensing

Root application code is AGPL-3.0-or-later. Public contracts, SDK, CLI, and MCP packages are MIT.
See `LICENSING.md` before moving code across those boundaries.
