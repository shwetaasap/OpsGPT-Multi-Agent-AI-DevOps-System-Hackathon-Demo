# Authentication Security Incident Runbook

Triggers: brute force login attempts, unusual auth failure spikes, account lockouts, credential stuffing patterns, password reset email failures.

## Quick checks
1. Identify the source IPs and the count of failed attempts per IP in the last 15 minutes.
2. Check whether attempts target a single account or many accounts (credential stuffing vs targeted attack).
3. Look for the User-Agent strings -- automated tools often have telltale signatures.
4. Check whether any account has succeeded after many failures (potential successful brute force).

## Immediate actions

### Brute force from a single IP
1. Block the offending IP at the WAF or load balancer level.
2. Apply rate limiting to login endpoints if not already in place: 5 attempts per 15 minutes per IP.
3. Lock the targeted account temporarily and require a password reset on next login.
4. Notify the account owner via the registered email.

### Credential stuffing (many accounts, one source)
1. Rate limit the entire login endpoint at the IP level.
2. Enable CAPTCHA for the affected source ranges.
3. Force-rotate sessions for any account that authenticated successfully from those IPs in the last 24 hours.
4. Cross-reference affected emails against known breach databases (Have I Been Pwned).

### Password reset email failures
1. Check SMTP server connectivity from the auth service.
2. Verify SMTP credentials are still valid.
3. Check the email provider's deliverability dashboard for sender reputation issues.
4. Confirm SPF, DKIM, and DMARC records are correct.
5. As a fallback, allow password reset via SMS or backup email.

## Follow-up
- Enable multi-factor authentication for all high-privilege accounts.
- Implement account lockout after N failed attempts (default: 10 in 15 min).
- Add anomaly detection: alert when a single IP attempts more than 3 distinct usernames.
- Consider using a managed bot protection service (Cloudflare, AWS Shield).

## Communication
- For widespread incidents: notify all users via in-app banner.
- For individual targeted accounts: direct email + force password reset on next login.
- Preserve all logs for forensic analysis -- do not rotate or delete.

## Escalation
- Security team on-call
- Legal/compliance if PII may have been exposed
- Customer support (prepare templated responses)
