# Data Protection And Lifecycle

Samrian handles tenant contact data, email content, provider credentials, and operational
telemetry. Controls follow data purpose and threat model; encrypting every searchable column would
break product queries without protecting data from a compromised application process.

## Classification

| Class        | Examples                                                                                        | Permitted storage                                                    | Primary controls                                    |
| ------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| Public       | Published status, public unsubscribe confirmation                                               | Public route response                                                | Integrity, abuse limits                             |
| Internal     | Resource IDs, aggregate capacity, deployment metadata                                           | Postgres, bounded queue metadata                                     | Auth, RLS, least privilege                          |
| Confidential | Contacts, subjects, bodies, headers, campaign content, analytics identifiers                    | Tenant Postgres, private S3                                          | RLS, encrypted storage/backups, retention           |
| Secret       | OAuth tokens, SMTP password, API/session keys, signing/encryption keys, DB/Redis/S3 credentials | Auth provider or encrypted credential field; deployment secret store | AEAD, hashing where applicable, redaction, rotation |

Passwords remain under Better Auth or WorkOS password handling and are never reversibly encrypted
by Samrian. Searchable tenant data uses RLS plus encrypted storage rather than field encryption.

## Data States

### Transit

- Browser, API, SDK, CLI, and MCP use HTTPS. Token-bearing automation permits plain HTTP only for
  `localhost`, `127.0.0.1`, and `[::1]`.
- SDK requests use manual redirects, preventing bearer forwarding to another origin.
- Managed PostgreSQL URLs require TLS; prefer `sslmode=verify-full`.
- Remote Redis uses `rediss://`. Redis and PostgreSQL service names are accepted only as the
  documented isolated Docker-network exception.
- S3-compatible and OTLP endpoints use HTTPS outside local Docker.
- Gmail, Graph, SMTP, and IMAP transport policy is documented in deployment and mailbox security
  guidance. Samrian controls submission and polling links, not every later SMTP relay.
- Run `bun run data:audit` before production deployment.

### At Rest

- Mailbox passwords and OAuth tokens use AES-256-GCM credential envelopes.
- Envelope AAD binds version, organization, mailbox, provider, and credential purpose.
- Postgres volumes, replicas, snapshots, PITR, and exports require provider or host-disk encryption.
- S3-compatible buckets remain private. Set `S3_SERVER_SIDE_ENCRYPTION=AES256` or `aws:kms`.
- Redis and queues contain identifiers and bounded metadata, not credentials, raw MIME, bodies, or
  recipient addresses.
- Better Auth/WorkOS own authentication credential storage. Samrian does not duplicate it.

### In Use

- Credentials decrypt immediately before connector construction.
- Plaintext credentials never enter repos, queues, logs, traces, errors, exports, CLI, or MCP.
- Provider calls occur outside DB transactions.
- JavaScript strings cannot be reliably zeroed. Samrian therefore avoids caches, globals, dumps,
  and serialization rather than claiming guaranteed memory erasure.

## Retention

| Data                                | Default                                            | Deletion behavior                                       |
| ----------------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| OAuth state                         | 10 minutes                                         | Expires cryptographically and cookie expires            |
| API idempotency                     | 24 hours                                           | Ignored after expiry; maintenance purge may remove rows |
| Temporary exports                   | At most 24 hours                                   | Delete temp object/file; signed URL expires earlier     |
| Notifications                       | 90 days                                            | Purge read/expired records after policy window          |
| Raw analytics events                | 365 days                                           | Delete or anonymize after rollup verification           |
| Active contacts, campaigns, threads | While tenant needs them                            | Explicit tenant/resource deletion                       |
| Archived mailbox                    | Metadata retained; credentials removed immediately | Provider revocation attempted, encrypted fields cleared |
| Deleted organization live data      | At most 30 days                                    | Remove primary, derived, object, queue, and cache data  |
| Backups containing deleted data     | At most 35 days                                    | Age out without restoring into ordinary service         |
| Security/audit evidence             | 365 days unless legal hold applies                 | Restricted deletion after review                        |

Hosted operators may shorten these values. Longer retention requires documented purpose, owner,
review date, and customer disclosure. Legal hold exceptions must be scoped and access-controlled.

S3 versioning needs both current-version expiration and `NoncurrentVersionExpiration`; a delete
marker alone does not erase older object versions.

## Credential Keys

Generate a 32-byte key with a CSPRNG:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Configure:

```text
CREDENTIAL_ACTIVE_KEY_ID=2026-01
CREDENTIAL_KEYS_JSON={"2026-01":"<64 hex characters>"}
```

Store keyring in deployment secret manager, separate from database/backups. Keep previous keys
decrypt-only while ciphertext or retained backups still depend on them.

Rotation:

```powershell
bun run crypto:rotate
bun run crypto:rotate -- --apply --limit=100
bun run crypto:rotate -- --apply --cursor=mailbox_last --limit=100
```

Dry-run reports only counts and resume cursor. Apply is idempotent. Do not remove old key until
dry-run reports zero stale credentials and restore drill succeeds.

Rollback means restoring previous application release while retaining both old and new keys.
Database rollback is unnecessary because both versions remain decryptable during rotation.

Compromise response:

1. Add new active key; keep compromised key decrypt-only temporarily.
2. Stop affected workers if active disclosure continues.
3. Rotate credential rows.
4. Revoke/re-authorize provider credentials where exposure is plausible.
5. Verify backups and audit evidence.
6. Remove compromised key only when no required ciphertext depends on it.

## Backup And Restore Evidence

Before launch and quarterly:

1. Restore Postgres and object metadata into isolated environment.
2. Supply active and approved previous credential keys from separate backup.
3. Apply migrations and runtime DB roles.
4. Run RLS tenant tests and credential decrypt checks.
5. Confirm archived mailbox credentials remain empty.
6. Confirm logs, health, CLI, MCP, and exports expose no secret fields.
7. Destroy restore environment and record provider deletion evidence.

Required operator evidence:

- Postgres disk, replica, snapshot, PITR, and export encryption.
- S3/R2/MinIO default encryption, private access, lifecycle, and version expiry.
- Redis persistence decision, volume encryption, ACL, network isolation, and backup behavior.
- Better Stack retention and access policy.
- Secret-manager key history and rotation record.

## Vulnerability Handling

Candidate finding -> reproduce -> identify data class/state -> measure prerequisites and tenant
blast radius -> search sibling surfaces -> write failing exploit test -> fix owning Module -> rerun
focused and full tests -> record evidence and residual risk.

Scanner output is not confirmed until validation. Severity includes exposure, data sensitivity,
cross-tenant reach, recoverability, and detection quality.
