# Development

Use this as current development reference.

## Start Local App

```powershell
bun install
Copy-Item .env.example .env.local
bun run db:test:up
bun run queue:test:up
bun run storage:test:up
bun run db:migrate
bun run dev
```

Optional worker process:

```powershell
bun run worker
```

## Quality Commands

```powershell
bun run test
bun run test:db
bun run type-check
bun run lint
bun run format:check
bun run build
bun run validate
```

`bun run validate` runs type-check, lint, and format check.

## Database

Schema lives under `src/server/db/schema`.

`DATABASE_URL` is migration-only. App and worker runtime use non-owner `APP_DATABASE_URL` and `WORKER_DATABASE_URL`. See `docs/RLS.md`.

```powershell
bun run db:generate
bun run db:migrate
bun run db:push
bun run db:studio
```

Use generated migrations for production. Use push only for local iteration.

## Architecture Rules

- UI, routes, and workers call server modules or app-owned ports.
- Drizzle imports stay inside `src/server/db`, `src/server/repos`, and tests.
- Queue provider imports stay inside `src/server/queue`, `src/server/worker`, and tests.
- Storage provider imports stay inside `src/server/storage` and tests.
- Auth/session/org checks live in `src/server/auth` or server modules, not repo adapters.
- Auth provider SDK imports stay inside `src/server/auth` adapters and auth route/proxy glue.
- Client code uses `src/lib/auth`, not provider SDK clients directly.
- Repo adapters expose domain behavior, not table-string CRUD.
- Raw SQL belongs only in migrations or test setup unless a repo test proves need.

## Adding Data Behavior

1. Write failing repo/module test.
2. Add or extend port only when missing behavior is proven.
3. Implement repo method behind Drizzle adapter.
4. Keep auth/org checks in module or route layer.
5. Run focused test, then full verification.

## Adding Job Behavior

1. Write failing handler test under `tests/unit/jobs`.
2. Put business flow in `src/server/jobs`.
3. Keep runtime mapping in Inngest or BullMQ adapter only.
4. Make handler idempotent under retries.
5. Run queue/worker tests when payload or retry behavior changes.

## Naming

- Use short, searchable file names.
- Prefer folder context: `jobs/send.ts`, `queue/bullmq.ts`, `storage/s3.ts`.
- Avoid vague names: `utils`, `helpers`, `manager`, `service`.
- Tests use `*.test.ts`; reusable port tests use `*.contract.test.ts`.

## Security Checklist

- Auth required before org data access.
- Org ownership checked before reads/writes.
- Secrets encrypted server-side only.
- No secrets in logs, health responses, or docs examples.
- User-facing errors do not leak other org resource existence.

## References

- `README.md`
- `docs/DEPLOYMENT.md`
- `CONTRIBUTING.md`

## Mailbox Ramp

Mailbox Ramp limits real campaign sends while a new or recovering mailbox builds stable sending
history. It does not send synthetic warmup messages, create fake replies, or guarantee inbox
placement.

Effective campaign capacity uses the lowest provider, user, and ramp limit. Sent messages,
follow-ups, queued reservations, and manual-reply reserve share that budget. Dispatcher reserves
capacity before enqueue; send worker rechecks before provider delivery.

Operators configure org defaults under **Settings > Sending** and control each mailbox from the
mailbox table. Daily evaluation can advance, hold, reduce, pause, or recover a mailbox from recent
delivery evidence. Calendar age only makes a mailbox eligible for evaluation; it never forces an
increase.

Useful checks:

```powershell
bun run test --project unit -- tests/unit/modules/ramp.test.ts tests/unit/jobs/ramp.test.ts
bun run test --project components -- tests/components/ramp.test.tsx
```
