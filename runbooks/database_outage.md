# Database Outage Runbook

Triggers: connection pool exhaustion, query timeouts, "too many connections" errors, replication lag.

## Quick checks
1. Open the database health dashboard and check active connection count.
2. Compare against `max_connections` in the database config.
3. Look at the slow query log for queries running longer than 5 seconds.

## Common causes
- An application opened many connections without closing them (connection leak).
- Long-running transactions blocking other queries.
- A missing index causing every query on a hot table to do a full scan.
- The database server itself is under-provisioned (CPU or memory pegged).

## Immediate actions
1. Identify the application using the most connections and restart it to free them.
2. Kill any query running longer than 30 seconds that is blocking others.
3. If queues are backing up, temporarily disable non-critical background jobs.
4. Page the on-call DBA if the outage exceeds 5 minutes.

## Follow-up
- Add connection pooling (PgBouncer for Postgres) if not already in place.
- Set statement timeouts on the application's database client.
- Add the missing index identified during the incident.
- Update monitoring to alert when connections exceed 70% of max.

## Escalation
- DBA on-call: see PagerDuty schedule "Database Primary"
- Vendor support: open a ticket with priority "production down"
