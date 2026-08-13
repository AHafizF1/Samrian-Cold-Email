# Deployment

This project supports two deploy paths: Docker/VPS self-host and managed/serverless.

## Required Env

Set these in every production environment:

- `AUTH_PROVIDER=better-auth|workos`
- `NEXT_PUBLIC_AUTH_PROVIDER=better-auth|workos`
- `CREDENTIAL_ACTIVE_KEY_ID`
- `CREDENTIAL_KEYS_JSON`
- `UNSUBSCRIBE_SECRET`
- `APP_DATABASE_URL`
- `WORKER_DATABASE_URL` when running workers
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SOURCE_URL` pointing to corresponding source for deployed revision
- Mailbox OAuth values: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`

Better Auth mode also requires `BETTER_AUTH_SECRET`, `AUTH_DATABASE_URL`, and Better Auth auth
tables in Postgres. `AUTH_DATABASE_URL` must use a login inheriting only `samrian_auth`.
WorkOS mode requires `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD`, and `NEXT_PUBLIC_WORKOS_REDIRECT_URI`; it does not require Better Auth auth tables for runtime auth.

Storage uses the S3-compatible env names from `.env.example`. Jobs use `JOB_PROVIDER=inngest` or `JOB_PROVIDER=bullmq`.

Hosted deployments must expose corresponding source through `NEXT_PUBLIC_SOURCE_URL`. Modified
forks should link their deployed revision to their own source repository or archive, not an
unrelated upstream revision. Docker images include `LICENSE`, `LICENSING.md`, and `NOTICE`.

`MASTER_ENCRYPTION_KEY` is legacy decrypt-only migration input. New deployments use the versioned
credential keyring. See `docs/DATA_LIFECYCLE.md` for generation, rotation, restore, and retirement.
Set explicit S3 server-side encryption; `aws:kms` also requires `S3_KMS_KEY_ID`.

Enforced production rate limits require `TRUSTED_PROXY_MODE=single`. Configure Vercel or the
deployment reverse proxy to overwrite `X-Forwarded-For`; never trust a client-appended chain.

Tenant SMTP/IMAP hosts resolve through Samrian's outbound network policy. Public IPs are required by
default. Self-hosters using a deployment-controlled private mail server may set
`OUTBOUND_ALLOW_PRIVATE_EMAIL_HOSTS=true`; hosted deployments should keep it `false`.

Observability is optional for local OSS mode with `OBSERVABILITY_PROVIDER=none`. Production should use `OBSERVABILITY_PROVIDER=betterstack` and Better Stack env names from `.env.example`. See `docs/OBSERVABILITY.md`.

## Docker/VPS

Docker/VPS mode runs Next.js, PostgreSQL, Redis, BullMQ worker, and optional MinIO/S3-compatible storage.

1. Copy `.env.example` to `.env`.
2. Fill required secrets.
3. Use `JOB_PROVIDER=bullmq`.
4. Use `REDIS_URL=redis://redis:6379`.
5. Set distinct `SAMRIAN_APP_DB_PASSWORD`, `SAMRIAN_AUTH_DB_PASSWORD`, and
   `SAMRIAN_WORKER_DB_PASSWORD` values before first database initialization.
6. Start infrastructure and app:

```powershell
docker compose --profile minio up -d --build
```

Run migrations:

```powershell
bun run db:migrate
```

Run worker outside compose only when needed:

```powershell
bun run worker
```

Health check:

```powershell
curl http://localhost:3000/api/health
```

Smoke check:

```powershell
bun run smoke
```

## Managed/serverless

Managed/serverless mode combines replaceable providers behind Samrian's existing database, job,
cache, storage, auth, and observability adapters.

### Provider-neutral requirements

Choose providers by capability, region, limits, and terms rather than brand:

- Next.js host with Node runtime support, HTTPS, protected environment variables, and enough
  function duration for Samrian routes.
- PostgreSQL with pooled runtime connections, direct migration connections, transactions, and
  support for the least-privilege roles and RLS described in `docs/RLS.md`.
- Managed job runtime for scheduled dispatch and retries, or Redis plus the BullMQ worker.
- Redis-compatible service for enforced distributed rate limits. Managed Inngest replaces BullMQ's
  job Redis requirement; it does not replace rate-limit Redis.
- Private S3-compatible object storage with TLS, server-side encryption, lifecycle rules, and
  recoverable credentials.
- Auth and observability providers supported by the corresponding Samrian adapters.

Keep app, database, Redis, job runtime, and storage in nearby regions. Verify connection, execution,
event, storage, and egress limits under expected campaign volume. Free-tier limits and
commercial-use terms change; check current official provider terms before every launch.

### Recommended starter profile

For a low-cost managed pilot, current recommended profile is:

- Vercel for Next.js hosting.
- Neon Postgres using pooled non-owner runtime URLs and direct owner migration URL.
- Inngest with `JOB_PROVIDER=inngest`.
- Upstash Redis using its TLS `rediss://` connection for enforced rate limits.
- Private Cloudflare R2 for S3-compatible objects and encrypted backup artifacts.
- Better Stack for production observability.
- Better Auth for self-contained OSS auth, or WorkOS for hosted SaaS auth.

This is an example profile, not a runtime dependency. Vercel Hobby is intended for personal,
non-commercial use; choose a commercial plan before accepting paid production traffic. Provider
free tiers usually have no production SLA and may suspend, throttle, or scale to zero after quota or
idle thresholds.

Current provider references:

- [Vercel plans](https://vercel.com/pricing)
- [Neon plans](https://neon.com/pricing)
- [Inngest plans and limits](https://www.inngest.com/pricing)
- [Upstash Redis plans](https://upstash.com/pricing/redis)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)

### Managed setup

1. Deploy Next.js app to Vercel.
2. Set `DATABASE_DRIVER=postgres-js`; tenant RLS requires interactive transactions. Neon users should use its pooled Postgres URL.
3. Set separate non-owner `APP_DATABASE_URL` and `WORKER_DATABASE_URL` values. Better Auth mode
   also sets non-owner `AUTH_DATABASE_URL`; WorkOS mode omits it. Keep owner `DATABASE_URL` only in
   migration job.
4. Set `JOB_PROVIDER=inngest`.
5. Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`.
6. Configure S3-compatible storage with AWS S3, Cloudflare R2, Backblaze B2, or another provider.
7. Run migrations before release:

```powershell
bun run db:migrate
```

See `docs/RLS.md` for role provisioning, managed Postgres constraints, rotation, and deploy order.

Before paid production, perform a backup and restore drill in an isolated environment. Prove restored
credential keys, encrypted mailbox data, RLS policies, and least-privilege runtime roles still work.
Free-tier availability is not backup evidence.

## OAuth callback URLs

Configure provider OAuth callback URLs with your production domain:

- WorkOS AuthKit: `https://your-domain.com/api/auth/workos/callback`
- Better Auth Google user login: `https://your-domain.com/api/auth/callback/google`
- `https://your-domain.com/api/auth/google/callback`
- `https://your-domain.com/api/auth/microsoft/callback`

Set `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` to the same production origin.

## Google user login

Better Auth mode uses `GOOGLE_AUTH_CLIENT_ID` and `GOOGLE_AUTH_CLIENT_SECRET` for Google user login. Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` only after both server values are present. The Google Console callback is `/api/auth/callback/google`.

WorkOS mode sends users to hosted AuthKit. Enable Google Social Login in WorkOS Dashboard and configure its Google credentials and redirect URI there. Do not add custom Google OAuth routing in Samrian for WorkOS mode.

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` remain mailbox-connect credentials. They power `/api/auth/google/*` and must not be reused for user authentication.

## Auth Provider Modes

Better Auth is default for OSS/self-host deployments. Users, accounts, organizations, and memberships are stored in app-owned Postgres auth tables.

WorkOS is optional for production SaaS/enterprise deployments. WorkOS owns hosted authentication, sessions, organizations, roles, and permissions. Samrian still owns domain authorization, org-scoped resource checks, and app data. Existing Better Auth users can be migrated to WorkOS using WorkOS migrations, but that migration is a separate rollout task.

Better Auth keeps its official Drizzle Adapter. Samrian changes only which PostgreSQL credential
backs that Adapter:

```text
Better Auth route -> AUTH_DATABASE_URL -> Better Auth tables
Product route     -> APP_DATABASE_URL  -> RLS tenant tables
Worker            -> WORKER_DATABASE_URL -> job-required tenant tables
```

WorkOS routes do not initialize Better Auth or `AUTH_DATABASE_URL`. No WorkOS user/session mirror is
created in Postgres.

### Roles And Permissions

Better Auth mode enables official dynamic organization access control. Apply Drizzle migrations
before using custom roles; `organization_roles` is a Better Auth-owned auth table, not an app role
store.

WorkOS mode uses organization roles from WorkOS Authorization. Before enabling role management,
create the canonical `resource:action` permission slugs from `lib/permissions.ts` in the WorkOS
Dashboard. Samrian sends only those canonical slugs to WorkOS and does not mirror custom roles in
Postgres.

Role and permission changes are checked server-side on every Samrian operation. Existing WorkOS
sessions may retain old claims until AuthKit refreshes the session; sign out and back in when
testing changed access. Better Auth uses its server permission API so dynamic roles are not checked
through stale synchronous client role data.

## Operations

- Health endpoint: `/api/health`
- Smoke command: `bun run smoke`
- Migration command: `bun run db:migrate`
- Worker command: `bun run worker`
- Data transport audit: `bun run data:audit`
- Credential rotation dry-run: `bun run crypto:rotate`

Health output never includes secrets or database URLs. If health is `degraded`, check database connectivity and env configuration first.
