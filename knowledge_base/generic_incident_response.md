# Generic Incident Response Runbook

Use when no specific runbook matches. Covers login/auth issues, payment failures, email/SMTP, slow web app, and any incident type not yet documented.

## Quick Checks
1. Confirm the scope: how many users / requests / services are affected?
2. Check for a recent deploy in the last 4 hours - rollback if it correlates.
3. Look at the dependency graph - is an upstream service degraded?
4. Check the status pages of any third-party providers used (Stripe, SendGrid, AWS, etc.).

## Common Failure Modes
- Auth: brute force attempts, account lockout, password reset emails not arriving.
- Payments: gateway timeout, rate limited (429), webhook delivery failing, sudden card decline spike.
- Email/SMTP: connection refused, authentication failed, high bounce rate, deliverability drop.
- Web app slowness: response times above SLA, 5xx spikes, request timeouts.

## Remediation Steps

### Auth incidents
1. Block the offending IP at the WAF or load balancer.
2. Apply rate limiting on login endpoints (5 attempts per 15 minutes per IP).
3. Lock the targeted account temporarily and require a password reset.
4. If password reset emails fail, enable an alternate channel (SMS, in-app code).
5. Verify SMTP credentials and check the email provider's deliverability dashboard.

### Payment incidents
1. Check the payment provider's status page first.
2. Increase request timeout to 30-60 seconds for gateway calls.
3. Implement idempotency keys so retries don't double-charge.
4. Implement client-side rate limiting at 80% of the published API limit.
5. Make webhook handlers idempotent and verify the webhook URL is publicly reachable.
6. Show actionable error messages to customers without exposing internal details.

### Email / SMTP incidents
1. Check the email provider's status page.
2. Verify SMTP credentials are still valid in the secret manager.
3. Confirm SPF, DKIM, and DMARC DNS records are correct.
4. Switch to a backup SMTP provider if one is configured.
5. For password resets, fall back to SMS or backup email.

### Web app slowness
1. Check requests-per-second - is traffic abnormally high?
2. Look at the slow query log for queries over 1 second.
3. Check CPU / memory / IO utilization on the application servers.
4. Add or fix indexes for the slow queries identified.
5. Cache responses for read-heavy endpoints with a sensible TTL.
6. Scale out if resource saturation is the cause.

## Always
- Preserve logs - do not rotate or delete during an active incident.
- Communicate via status banner if the incident is user-visible.
- Open a ticket and document everything for the postmortem.

## Escalation
- Service owner on-call for application-specific issues.
- Platform / SRE for infrastructure issues.
- Security team if PII or credentials may be exposed.
