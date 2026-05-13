# Email and SMTP Failures Runbook

Triggers: password reset emails not arriving, transactional email delivery failures, SMTP connection refused, sender reputation drop, bounce rate spike.

## Quick checks
1. Check the email provider's status page (status.sendgrid.com, status.ses.amazonaws.com, etc.).
2. Look at the bounce rate over the last hour. Above 5% indicates a deliverability problem.
3. Test SMTP connectivity from the application host using a manual connection.
4. Verify SMTP credentials are still valid in the secret manager.

## Common causes

### SMTP connection refused
- Network egress blocked (firewall change, security group).
- Provider rotated their SMTP endpoint and the old one was hardcoded.
- Wrong port -- must be 587 for STARTTLS or 465 for SMTPS.

### Authentication failed
- Credentials rotated and not updated in the application config.
- Credentials in the right place but not loaded due to a deployment issue.
- The provider revoked the API key after detecting suspicious activity.

### High bounce rate
- DNS records (SPF, DKIM, DMARC) changed or expired.
- Sending from a new IP without warmup.
- Mailing to dirty lists with many invalid addresses.
- Sender domain on a blocklist -- check reputation services.

### Emails go to spam
- Missing or misconfigured DKIM signature.
- DMARC policy too permissive or missing.
- Subject lines triggering spam filters.
- Plain-text version missing from HTML emails.

## Immediate actions
1. If transactional emails (password resets) are blocked: enable an alternate channel (SMS, in-app code).
2. Pause non-critical email campaigns to protect sender reputation.
3. Switch to a backup SMTP provider if one is configured.
4. Notify users via a status banner that emails may be delayed.

## Follow-up
- Implement a queue with retries for outgoing emails so brief outages don't lose messages.
- Add dead-letter handling for permanently failed sends.
- Monitor sender reputation with a service like Google Postmaster Tools.
- Maintain a backup email provider as a hot standby.
- Run a deliverability test before any major campaign.

## Customer communication
- For password reset failures: offer "didn't get the email?" CTA with alternate contact options.
- For broader email outages: post a banner and include a phone or chat fallback.

## Escalation
- DevOps for infrastructure or DNS issues.
- Marketing/Growth team if it affects campaigns.
- Security if the cause is suspicious account activity.
