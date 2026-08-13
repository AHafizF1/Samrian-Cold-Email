# PostgreSQL Tenant Isolation

Samrian uses two tenant controls:

1. App auth, permission, ownership, validation, and explicit `orgId` repo filters.
2. PostgreSQL row-level security as containment if app filtering is missed.

## Roles

| Credential            | PostgreSQL login         | Purpose                                          |
| --------------------- | ------------------------ | ------------------------------------------------ |
| `DATABASE_URL`        | migration owner          | Schema migrations and role/policy administration |
| `AUTH_DATABASE_URL`   | `samrian_auth_runtime`   | Better Auth tables only                          |
| `APP_DATABASE_URL`    | `samrian_app_runtime`    | Next.js tenant product data                      |
| `WORKER_DATABASE_URL` | `samrian_worker_runtime` | BullMQ/Inngest tenant and scheduled work         |

Runtime logins must be `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, and `NOBYPASSRLS`.
Permission groups are `NOLOGIN`; runtime accounts inherit exactly one:

- `samrian_auth` can access Better Auth identity, session, organization, role, and API-key tables.
- `samrian_app` can access RLS-protected product tables.
- `samrian_worker` can access job-required product tables.

`AUTH_DATABASE_URL` is required only in Better Auth mode. WorkOS owns auth data and never opens
that connection. App and worker roles cannot read auth tables; auth role cannot read product tables.

Docker creates local runtime logins through `scripts/db/init-roles.sh`. Set distinct generated
`SAMRIAN_APP_DB_PASSWORD`, `SAMRIAN_AUTH_DB_PASSWORD`, and `SAMRIAN_WORKER_DB_PASSWORD` values
before first production volume initialization.

## Request Context

`withTenant()` starts one DB transaction and uses parameterized `set_config(..., true)` calls for:

- `app.org_id`
- `app.user_id`
- `app.actor_type`

`true` makes values transaction-local, preventing pooled-connection leakage. Same-context nesting reuses transaction. Tenant switching inside active transaction fails.

Public tracking first uses token-scoped `tracked_links` SELECT policy. Signed unsubscribe verifies token before entering tenant transaction.

## Deploy Order

1. Provision group/runtime roles.
2. Set owner-only `DATABASE_URL` in migration environment.
3. Run `bun run db:migrate`.
4. Remove owner URL from app, auth, and worker environments.
5. In Better Auth mode, set `AUTH_DATABASE_URL`.
6. Set `APP_DATABASE_URL` and `WORKER_DATABASE_URL`.
7. Start app and worker.
8. Run `bun run test:db` with dedicated test URLs.

Production startup rejects owner-only fallback when purpose-specific runtime URL is missing.

## Managed Postgres

### Neon

Create separate login roles through Neon SQL editor/admin connection. Grant exactly one of
`samrian_auth`, `samrian_app`, or `samrian_worker`, then use each login's pooled URL. Keep owner URL
only in migration job. Use pooled `postgres-js`; `withTenant()` requires interactive transactions
and transaction-local context.

### Supabase

Create separate Postgres login roles through SQL editor/admin connection. Do not use `postgres`,
service-role credentials, or a role with `BYPASSRLS` for auth/app/worker traffic. Use transaction
pooler URLs for runtime roles and direct owner URL for migrations. Supabase API-key RLS behavior
does not replace Samrian's direct-Postgres role policies.

## Rotation

1. Create replacement non-owner login.
2. Grant matching group role.
3. Update runtime secret and restart affected process.
4. Verify health and tenant isolation tests.
5. Revoke old login.

Never rotate migration and runtime credentials as one shared secret.

## Rollback

Application rollback must keep RLS enabled. Roll back app image first. Do not disable policies to restore service. If migration rollback is required, use owner migration credential and retain `FORCE ROW LEVEL SECURITY` on every tenant table.

## References

- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL privileges](https://www.postgresql.org/docs/current/ddl-priv.html)
- [Better Auth Drizzle Adapter](https://better-auth.com/docs/adapters/drizzle)
- [WorkOS AuthKit sessions](https://workos.com/docs/authkit/sessions)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Supabase Postgres roles](https://supabase.com/docs/guides/database/postgres/roles)
