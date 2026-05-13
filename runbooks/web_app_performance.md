# Web App Performance Runbook

Triggers: response times above SLA, 5xx error spikes, request timeouts, slow page loads, database query timeouts.

## Quick checks
1. Look at the requests-per-second graph over the last hour -- is traffic abnormally high?
2. Check the slow query log on the database for queries over 1 second.
3. Look at CPU and memory utilization on the application servers.
4. Check whether one specific endpoint is slow or all endpoints are.

## Common causes and fixes

### Slow database queries
- Run EXPLAIN ANALYZE on the slow query to find the plan.
- Add an index on the columns used in WHERE / JOIN clauses.
- Consider denormalizing for read-heavy queries.
- Use a read replica for analytical queries.

### N+1 query problems
- Look for loops in the code that issue one query per iteration.
- Replace with eager loading or a single batched query.
- Add monitoring for queries-per-request to catch new N+1s early.

### Missing cache
- Identify endpoints that hit the database for data that changes rarely.
- Add a Redis or in-memory cache with a sensible TTL (5-60 minutes).
- Cache at the right layer -- function level, HTTP level, or CDN.

### Resource saturation
- If CPU is pegged: profile to find hot code paths, add more replicas.
- If memory is pegged: look for memory leaks, increase per-instance memory.
- If I/O is saturated: move to faster storage or add caching.

### Large payloads
- Compress responses (gzip, brotli).
- Paginate large lists.
- Send only the fields the client actually needs (sparse fieldsets).

## Customer-visible mitigations
- Show a loading spinner with a friendly message on slow pages.
- Cache aggressively to make at least the homepage fast.
- Use a CDN for static assets.
- Implement graceful degradation -- show cached or simplified content when the database is slow.

## Follow-up
- Add p95 and p99 latency monitoring per endpoint.
- Set SLOs: 99% of requests under 500ms.
- Run periodic load tests to find regressions early.

## Escalation
- Backend on-call for application-level issues.
- DBA for database performance issues.
- SRE for infrastructure or capacity issues.
