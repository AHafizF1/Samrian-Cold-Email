# Security Workflow

Use this workflow for local and CI checks. Keep active findings and launch evidence in private
advisories or the maintainer issue tracker until remediation is complete.

## Safety Model

- Docker runs pinned official scanners. No host scanner install is required.
- API fuzzing rejects production targets.
- Security environment has no worker and unusable provider/storage endpoints, preventing real sends.
- Reports live under `security/reports/<run-id>/` and are not committed.
- Scanner output remains candidate finding until validated.

## Disposable Local Environment

```powershell
docker compose -f docker-compose.security.yml up -d --build
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5434/samrian_security"
$env:SECURITY_DISPOSABLE = "I_UNDERSTAND_THIS_DATA_IS_DISPOSABLE"
$env:SECURITY_APP_URL = "http://localhost:3100"
$env:SECURITY_AUTH_PASSWORD = "<security-only-password>"
bun run db:migrate
$seed = bun run security:seed | ConvertFrom-Json
```

Seed creates deterministic two-org fixtures, owner/admin/member users, and scoped API keys through
normal app paths. Plaintext keys exist only in `$seed`. No test-only auth bypass exists.

Reset disposable data:

```powershell
docker compose -f docker-compose.security.yml down -v
```

## Dry Run

```powershell
bun run security:semgrep --dry-run
bun run security:gitleaks --dry-run
bun run security:trivy --dry-run
bun run security:schemathesis --dry-run
bun run security:audit --dry-run
```

## Security Suite

```powershell
$env:SECURITY_BASE_URL = "http://host.docker.internal:3100"
$env:SAMRIAN_TOKEN = "scoped-test-key"
bun run security:audit
```

`security:audit` runs Semgrep, Gitleaks, Trivy, and bounded Schemathesis. Execution/config failures
fail. Gitleaks findings fail. Other findings remain triage evidence until validated.

## API Authorization And Tampering

`/api/v1/openapi.json` is canonical contract. Run Schemathesis separately with read-only and operator
keys. Token passes through Docker environment, never command arguments or tracked config.

```powershell
$env:SECURITY_BASE_URL = "http://host.docker.internal:3100"
$env:SAMRIAN_TOKEN = "scoped-test-key"
bun run security:schemathesis
```

Deterministic API tests remain primary security proof. For every private operation test missing auth,
missing scope, wrong role, wrong-org IDs, nested cross-org IDs, unknown fields, oversized values, duplicate
requests, and concurrency. Run same contract under Better Auth and WorkOS. Campaign launch and inbox reply
must use disposable fixtures and explicit tests; no security command may send real email.

## Triage

1. Record run ID and artifact path in the private audit record or security advisory.
2. Triage imported output.
3. Validate before confirming vulnerability.
4. Search related surfaces.
5. Add RED exploit test before approved fix.
6. Fix, then run security diff scan.

Filter Better Stack evidence by `sec_<uuid>` correlation/request ID. Reports and logs must not contain
authorization headers, cookies, passwords, provider tokens, message bodies, or recipient data.
