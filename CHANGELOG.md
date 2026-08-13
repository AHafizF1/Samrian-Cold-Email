# Changelog

Notable Samrian changes are recorded here. The project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and intends to use semantic versioning
after its first public release.

## [Unreleased]

### Added

- PostgreSQL and Drizzle data layer with tenant RLS and least-privilege runtime roles.
- Better Auth and WorkOS provider-neutral authentication modes.
- Campaign launch, scheduling, mailbox rotation, ramp controls, and durable workers.
- Reply, bounce, unsubscribe, inbox, notification, tracking, and analytics workflows.
- S3-compatible storage and Inngest/BullMQ queue adapters.
- Versioned automation API, typed SDK, CLI, and agent-safe MCP server.
- OpenTelemetry and Better Stack-ready observability foundation.
- Docker/VPS and managed/serverless deployment documentation.
- Security test matrix, rate limits, outbound-network controls, and encrypted credential lifecycle.
- AGPL application license with MIT contracts, SDK, CLI, and MCP packages.

### Changed

- Rebuilt backend architecture around app-owned modules, ports, repos, and provider adapters.
- Standardized product identity as Samrian.
- Replaced npm lock policy with Bun workspaces and `bun.lock`.

### Removed

- Convex runtime, generated files, dependencies, scripts, and active documentation.
