# Memory Leak Runbook

Triggers: out of memory, OOMKilled, container killed exit code 137, gradual memory growth, swap thrashing, process killed by oom-killer.

## Quick Checks
1. Look at the per-instance memory usage graph over the last 24 hours.
2. Check whether memory growth is linear over time (true leak) or step-wise after specific requests.
3. Look at the application's heap or working-set size compared to the container/VM limit.
4. Identify which endpoint or background job correlates with the growth.

## Common Causes
- Caches without eviction or TTL.
- Large objects held in long-lived global variables.
- Goroutines or threads leaked without cleanup.
- Database query loading entire tables into memory.
- Memory mapped files not released.

## Remediation Steps
1. Restart the affected application to immediately free memory and stabilize the service.
2. Increase the memory limit on the container or instance as a temporary buffer.
3. Capture a heap dump or memory profile before the next restart for root-cause analysis.
4. Reduce the workload temporarily by scaling out (more replicas, smaller per-instance load).
5. Identify and fix the leaking code path - usually a cache or collection that grows unbounded.
6. Add per-cache size limits and TTLs as part of the fix.

## Follow-up
- Add memory-usage alerts at 70% and 85% of the container limit.
- Run periodic load tests with memory profiling to catch regressions.
- Set HorizontalPodAutoscaler or equivalent to scale out under memory pressure.
- Use a Vertical Pod Autoscaler to right-size limits over time.

## Escalation
- Service owner on-call for the affected application.
- Platform team if the issue is widespread across many services.
