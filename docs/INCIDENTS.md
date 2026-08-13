# Incidents

Samrian incident workflow uses Better Stack for uptime checks, alerting, on-call routing, and status page updates.

## Severity

| Severity | Meaning                        | Notify | Examples                                                           |
| -------- | ------------------------------ | ------ | ------------------------------------------------------------------ |
| `P1`     | Critical user-impacting outage | page   | app down, auth down, sending globally down, data loss risk         |
| `P2`     | Major degradation              | alert  | degraded sending or polling, DB/queue instability, high error rate |
| `P3`     | Limited degradation            | ticket | single provider issue, non-critical API degraded                   |
| `P4`     | Maintenance or documentation   | ticket | planned maintenance, docs/status correction                        |

## Workflow

1. acknowledge incident in Better Stack.
2. Assign owner and severity.
3. Add metadata: environment, service, route, jobName, orgId, traceId, correlationId.
4. escalate if owner cannot mitigate within target response window.
5. Post status page update when user-visible.
6. resolve only after monitors recover and root behavior is verified.
7. Add post-incident notes with cause, fix, prevention, and follow-up tasks.

## Status Update Template

```text
We are investigating degraded Samrian service in <component>.
Impact: <affected users/workflows>.
Next update: <time>.
```

## Resolution Template

```text
Issue resolved.
Impact window: <start> - <end>.
Cause: <short cause>.
Follow-up: <prevention task>.
```

## Maintenance Template

```text
Scheduled maintenance for <component>.
Window: <start> - <end>.
Expected impact: <impact>.
Rollback plan: <plan>.
```
