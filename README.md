# Samrian Cold Email

Self-hostable cold email platform for campaigns, contacts, mailboxes, inbox replies, durable notifications, and delivery jobs.

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS
- PostgreSQL with Drizzle ORM
- Better Auth with organizations
- Inngest for managed/serverless jobs
- BullMQ + Redis for Docker/VPS jobs
- S3-compatible object storage for AWS S3, Cloudflare R2, Backblaze B2, or MinIO

## Local Setup

Install deps:

```powershell
bun install
```

Copy env:

```powershell
Copy-Item .env.example .env.local
```

Start local infrastructure:

```powershell
bun run db:test:up
bun run queue:test:up
bun run storage:test:up
```

Run migrations:

```powershell
bun run db:migrate
```

Start app:

```powershell
bun run dev
```

Open `http://localhost:3000`.

## Common Commands

```powershell
bun run test
bun run test:db
bun run type-check
bun run lint
bun run build
bun run smoke
docker compose config
```

## Architecture

Runtime code depends on app-owned seams, not provider SDKs:

```txt
UI / route handlers / workers
  -> server modules
  -> repos / queue / storage / crypto / auth ports
  -> provider adapters
```

Provider adapters:

- DB: Drizzle/PostgreSQL under `src/server/db` and `src/server/repos`
- Auth: Better Auth under `src/server/auth`
- Jobs: shared handlers under `src/server/jobs`; Inngest and BullMQ adapters call same handlers
- Storage: `ObjectStore` port with S3-compatible adapter
- Crypto: versioned, context-bound mailbox credential encryption with rotatable keyring

## Project Layout

```txt
src/app/          Next.js routes and UI
src/components/   shared React components
src/server/auth/  auth config and session/org helpers
src/server/db/    Drizzle schema, DB client, transactions
src/server/jobs/  provider-neutral job handlers
src/server/ports/ app-owned interfaces
src/server/repos/ Postgres repo adapters
src/server/queue/ queue provider adapters
src/server/storage/ object storage adapters
tests/            unit, contract, repo, API, component, deploy tests
docs/             current development and deployment docs
drizzle/          generated migrations
```

## Deployment

Docker/VPS mode runs app, Postgres, Redis, worker, and optional MinIO:

```powershell
docker compose --profile minio up -d --build
bun run db:migrate
bun run smoke
```

Managed/serverless mode uses Vercel, managed Postgres, Inngest, and S3/R2-compatible storage. See `docs/DEPLOYMENT.md`.

## Quality Bar

Before release:

```powershell
bun run validate
bun run test
bun run test:db
bun run build
docker compose config
```

Use short domain-first names, keep provider SDKs inside adapter folders, and add tests before changing behavior.

## License

Samrian application and server code are licensed under AGPL-3.0-or-later. Public contracts, SDK,
CLI, and MCP packages are licensed under MIT. See [LICENSING.md](LICENSING.md) for exact component
boundaries and [TRADEMARKS.md](TRADEMARKS.md) for brand-use guidance.

## Community

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes.
- Follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) in project spaces.
- Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
- Review pending public changes in [CHANGELOG.md](CHANGELOG.md).
