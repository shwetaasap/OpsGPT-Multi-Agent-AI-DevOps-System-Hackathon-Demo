# Kubernetes Pod CrashLoop Runbook

Triggers: CrashLoopBackOff, pod restart count climbing, app keeps crashing on startup, container exit code non-zero, ImagePullBackOff, container dies during init.

## Quick Checks
1. Inspect pod status to see the exact phase and the restart count.
2. Look at the logs from the previous container instance, not just the current one.
3. Check the exit code reported by the container runtime.
4. Verify all required environment variables and secrets are set.
5. Confirm dependencies (database, queue, downstream service) are reachable from the pod.

## Common Causes
- Missing or wrong environment variable (e.g., DATABASE_URL not set).
- Missing or incorrect secret mount.
- Application startup expects a database that isn't ready yet.
- Image pull failure - registry credentials wrong, image tag missing, or registry unreachable.
- Insufficient memory or CPU causing OOM during startup.
- Failing readiness or liveness probe with too-tight thresholds.
- Bad config file mounted via ConfigMap.

## Remediation Steps
1. Read the previous-instance logs to see the actual error message printed before the crash.
2. Verify all required environment variables and secrets are set in the deployment spec.
3. Confirm the container can reach its dependencies from inside the pod network.
4. If the image cannot be pulled, fix imagePullSecrets or correct the image tag.
5. If startup OOMs, raise the memory limit or reduce the startup workload.
6. Loosen liveness probe thresholds if the app legitimately takes a while to warm up.
7. Roll back to the last known-good image if the crash started after a deploy.

## Follow-up
- Add a CI check that validates required environment variables are documented and present.
- Add startup probes for slow-starting applications instead of loosening liveness probes.
- Alert when restart count exceeds 5 within 15 minutes.

## Escalation
- Service owner on-call.
- Platform team for cluster-wide issues (image pulls failing across many services, etc.).
