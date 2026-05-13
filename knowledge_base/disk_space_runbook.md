# Disk Space Runbook

Triggers: "no space left on device", disk usage above 90%, backup failures with disk-full errors, write failures, transactions rolled back due to no space.

## Quick Checks
1. Run a disk usage report grouped by directory size to find the biggest consumers.
2. Check log directories - `/var/log` and application log paths frequently grow unbounded.
3. Check temporary upload directories and old backup archives.
4. Look for forgotten core dump files.

## Common Causes
- Log files growing without rotation.
- Old backup archives never cleaned up.
- Container images and layers piling up on a host.
- Application writing temporary files without cleaning them up.
- Database WAL or temp files growing during a long migration.

## Remediation Steps
1. Compress or rotate large active log files. Most logging libraries support log rotation; if it is not enabled, enable it now.
2. Delete old backup archives older than the documented retention window. Default retention: 7 daily, 4 weekly, 6 monthly.
3. Clear temporary upload directories - files older than 24 hours are usually safe to remove.
4. Remove old container images if running on a container host.
5. Disable non-essential services that write to disk until pressure is relieved.
6. If on cloud storage, expand the volume after cleanup if the workload genuinely needs more space.

## What NOT to Do
- Do not delete files in `/var/lib` or database data directories.
- Do not delete files belonging to running processes (use `lsof` to verify).
- Do not bypass retention policies without coordinating with the backup team.

## Follow-up
- Configure automatic log rotation with size-based and age-based limits.
- Schedule a recurring cleanup job for backup archives and temporary files.
- Add disk usage alerts at 75% (warning) and 85% (critical).
