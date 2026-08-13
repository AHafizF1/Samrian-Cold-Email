# Contributing

Samrian welcomes bug fixes, tests, docs, integrations, and focused product improvements.

## Setup

```powershell
bun install
Copy-Item .env.example .env.local
bun run db:test:up
bun run db:migrate
bun run dev
```

See `README.md` and `docs/DEVELOPMENT.md` for current setup details.

## Architecture

Keep dependencies moving inward:

```text
UI / routes / workers
  -> server modules
  -> repos and app-owned ports
  -> provider adapters
```

- Routes and UI do not import Drizzle, queue clients, or provider SDKs.
- Server modules own business rules and authorization intent.
- Repos own database mechanics and tenant-scoped access.
- Provider adapters stay behind app-owned interfaces.
- Public packages under `packages/` remain independent from server implementation.

## Changes

- Read existing flow before editing.
- Write a failing test before behavior changes.
- Prefer smallest change that satisfies tested behavior.
- Extract shared logic after three real repetitions, not anticipated reuse.
- Use short, domain-specific file names. Avoid `utils`, `helpers`, `manager`, and `service`.
- Validate inputs at trust boundaries.
- Preserve organization isolation and least-privilege DB access.
- Never log secrets, credentials, message bodies, or authorization headers.

## Tests

Run focused tests while working, then full gates:

```powershell
bun run format
bun run validate
bun run test
bun run test:db
bun run build
```

Docker-backed tests may require local Postgres, Redis, or MinIO.

Test enduring behavior, security invariants, and public contracts. Keep each invariant at the
cheapest seam that gives confidence; repeat it at another layer only when integration risk requires
it. Avoid assertions about private implementation text, documentation wording, or file placement
when type checking, build, or a behavior test already catches the failure. Name tests after product
behavior, never milestones or implementation phases.

## Licensing Contributions

Contributions are accepted under the license covering the component changed:

- Root application, server, workers, migrations, and operational scripts:
  `AGPL-3.0-or-later`.
- `packages/contracts`, `packages/sdk`, `packages/cli`, and `packages/mcp`: `MIT`.

See `LICENSING.md` for exact boundaries. By submitting a contribution, you confirm that you have
the right to provide it under the applicable component license. Do not copy code, assets, fonts, or
other material without compatible permission and preserved notices.

Samrian does not currently require DCO sign-off or a CLA. Do not add `Signed-off-by` lines unless
project policy changes and enforcement is added consistently.

## Pull Requests

- Keep one coherent change per PR.
- Explain behavior and reason, not implementation narration.
- Include tests and docs when behavior or public contracts change.
- Call out migrations, security impact, compatibility risk, and intentional deferrals.
- Use Conventional Commits, for example `feat: add campaign validation`.

Before review:

- [ ] Focused tests pass.
- [ ] `bun run validate` passes.
- [ ] Full relevant tests pass.
- [ ] Auth, org isolation, and input validation were reviewed.
- [ ] No secrets or generated reports were committed.
- [ ] New files follow existing naming conventions.
- [ ] License and third-party notices remain accurate.
