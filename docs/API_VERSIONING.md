# API Versioning

- Stable automation routes use a major path: `/api/v1`.
- Additive optional fields and new operations may ship within v1.
- Removing fields, changing field meaning, tightening valid existing values, or changing error
  semantics requires v2.
- Deprecated v1 behavior remains documented for one release cycle before removal.
- Internal UI routes under `/api` are not public automation contracts.
- Shared Zod contracts, OpenAPI, SDK, CLI, and MCP must change together.
- CI contract tests reject unregistered or mismatched operations.
