<!-- Captured by running `from agents.graph import build_graph; build_graph().invoke(...)` against disk_full.log. -->
<!-- severity=critical validator=approved retries=0 score=7 rag_confidence=high -->

# Incident Analysis Report

## Routing Decision
- **Severity:** critical
- **Incident type:** disk_full
- **Routing path:** `critical_deep_analysis_rag_validation_approval`
- **Routing reason:** 6 incident(s) detected (top categories: Disk Full, Disk Full, Disk Full); aggregate severity = critical.
- **Flags:** deep_analysis=True, rag=True, human_approval=True, ticket=True, notification=True

## Validator / Critic Review
- **Status:** approved
- **Quality score:** 7/10
- **Retry count:** 0
- **Human approval required:** True
- **Escalation required:** True
- **Reason:** Remediation passes quality bar for critical severity (score=7/10).
- **Issues:**
  - INC-001: no escalation guidance for critical incident
  - INC-001: potentially destructive action without approval gate
  - INC-002: no escalation guidance for critical incident
  - INC-002: potentially destructive action without approval gate
  - INC-003: no escalation guidance for critical incident
  - INC-003: potentially destructive action without approval gate
  - INC-004: no escalation guidance for critical incident
  - INC-005: no escalation guidance for critical incident
  - INC-006: no escalation guidance for critical incident

**6 incidents** classified.

## INC-001 — Disk Full on `backup` (high)
The backup process failed due to no space left on the device.

**Fix rationale:** The backup process failed because the device ran out of disk space, which is a common issue that can be resolved by clearing unnecessary files and optimizing disk usage.

**Steps:**
1. Run a disk usage report to identify which directories are using the most space.
2. Compress or rotate large log files to reduce disk usage.
3. Delete old backup archives that are older than the retention period.
4. Clear temporary upload directories, especially files older than 24 hours.
5. Disable any non-essential services that are writing to disk until space is restored.

## INC-002 — Disk Full on `webapp` (high)
The web application failed to write uploads due to no space left on the device.

**Fix rationale:** The web application encountered a disk full error which prevents it from writing uploads. By following the steps from the Disk Space Runbook, we can free up space on the device and prevent further upload failures.

**Steps:**
1. Compress or rotate large active log files to reduce disk usage.
2. Delete old backup archives that are beyond the 7-day retention period.
3. Clear temporary upload directories to remove files older than 24 hours.
4. Remove old container images that are not currently in use.
5. Monitor the available disk space and ensure it remains above 10% to avoid future issues.

## INC-003 — Disk Full on `database` (high)
The database encountered issues due to being out of disk space.

**Fix rationale:** The database is experiencing disk full issues, which can be mitigated by cleaning up unnecessary files and optimizing stored data.

**Steps:**
1. Compress or rotate any large active log files that are consuming disk space.
2. Delete any old backup archives that are beyond the 7 daily, 4 weekly, and 6 monthly retention policy.
3. Clear out temporary upload directories to free up space, focusing on files older than 24 hours.
4. Consider removing old container images if they are present on the database host.
5. Monitor and disable non-essential services writing to disk until the issue is resolved.

## INC-004 — Disk Usage Warning on `monitor` (warn)
Disk usage on /var is critically high at 99%.

**Fix rationale:** The root cause of the incident is that disk usage on /var has reached a critical level of 99%, impacting system performance and potentially causing failures. Implementing log rotation and scheduled cleanup will help manage disk space and prevent future occurrences.

**Steps:**
1. Check which files are taking up the most space in the /var directory.
2. Inspect log files in the /var/log directory to see if any are excessively large.
3. Set up automatic log rotation to manage log file sizes and age.
4. Schedule a recurring cleanup job to remove old backup archives and temporary files.
5. Configure disk usage alerts to monitor space at 75% and 85% thresholds.

## INC-005 — Log File Size Warning on `monitor` (warn)
Log file has grown too large, reaching 12 GB.

**Fix rationale:** The log file has exceeded the manageable size limit, which can lead to disk space issues and application instability. Implementing automatic log rotation and regular cleanups will prevent future occurrences of similar problems.

**Steps:**
1. Check the current log file sizes to identify the largest ones.
2. Configure automatic log rotation to limit the size of each log file based on age and size.
3. Schedule a recurring cleanup job to remove old backup archives and unnecessary temporary files.
4. Add disk usage alerts to monitor disk space when usage hits 75%.
5. Verify that the log rotation is functioning as expected after implementation.

## INC-006 — User Uploads Disabled on `webapp` (critical)
User uploads have been disabled due to critical disk space issues.

**Fix rationale:** User uploads were disabled because the disk space hit critical levels, causing critical functionalities to halt. Addressing disk space issues through a series of clean-up actions will resolve the immediate problem and prevent future occurrences.

**Steps:**
1. Check current disk usage to understand how much space is occupied.
2. Clear unnecessary files, focusing on backups and temporary files.
3. Consider increasing disk capacity if cleanup does not free up sufficient space.
4. Implement automated log rotation and cleanup jobs to manage space effectively in the future.
5. Set up alerts for disk usage at 75% and 85% levels to monitor and prevent critical situations.


# Consolidated Incident Response Checklist
- [ ] Check and free up disk space immediately.
- [ ] Delete unnecessary files to create more space.
- [ ] Clear old log files that are not needed.
- [ ] Optimize database storage to reduce space usage.
- [ ] Implement log rotation for large files.
- [ ] Ensure backup process is functional after clearing space.
- [ ] Check web application for upload functionality.
- [ ] Confirm that user uploads are restored after issue resolution.
- [ ] Monitor disk usage regularly to prevent future issues.
- [ ] Schedule regular cleanups to maintain disk space.
- [ ] Set alerts for high disk space usage.
- [ ] Review disk space policies and adjust as needed.
- [ ] Educate team on best practices for disk management.

_Execution path: classify → severity_router → deep_analysis → rag_retriever → remediate → validator → cookbook → human_approval → slack → jira_
_Slack thread: `mock-slack-inc-001`_
_JIRA tickets: OPS-1001_