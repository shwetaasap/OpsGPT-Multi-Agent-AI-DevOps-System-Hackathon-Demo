# Database Connection Pool Runbook

Triggers: "too many connections", connection pool exhaustion, query timeouts, "FATAL: remaining connection slots are reserved", slow queries, transactions rolling back.

## Quick Checks
1. Open the database health dashboard and check active connection count.
2. Compare against `max_connections` in the database config.
3. Look at the slow query log for queries running longer than 5 seconds.
4. Check whether one application is responsible for most of the connections.

## Common Causes
- An application opened many connections without closing them (connection leak).
- Long-running transactions blocking other queries.
- A missing index causing every query on a hot table to do a full scan.
- The database server is under-provisioned (CPU or memory pegged).
- Pool size in the application was not tuned for current traffic.

## Remediation Steps
1. Identify the application using the most connections and restart it to free them.
2. Kill any query running longer than 30 seconds that is blocking others.
3. Reduce the application's connection pool size if it exceeds 50% of database max.
4. If queues are backing up, temporarily disable non-critical background jobs.
5. Add the missing index identified by EXPLAIN ANALYZE if a slow query is the cause.
6. Page the on-call DBA if the outage exceeds 5 minutes.

## Follow-up
- Add connection pooling middleware (PgBouncer for Postgres) if not in place.
- Set statement timeouts on the application's database client.
- Update monitoring to alert when connections exceed 70% of max.

## Escalation
- DBA on-call.
- Vendor support for managed-database issues.
