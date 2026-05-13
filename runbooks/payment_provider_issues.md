# Payment Provider Issues Runbook

Triggers: payment gateway timeouts, Stripe/PayPal API errors, rate limit (429), webhook delivery failures, sudden spike in declined cards.

## Quick checks
1. Check the payment provider's status page first (status.stripe.com, status.paypal.com).
2. Look at the payment failure rate over the last 15 minutes -- is it concentrated on one provider or across all?
3. Check whether the failures correlate with a specific card brand, region, or amount range.

## Common causes and fixes

### Gateway timeouts
- Often caused by network issues between your service and the provider.
- Increase request timeout to 30-60 seconds.
- Implement idempotency keys so retries don't double-charge.
- Add exponential backoff with jitter for retries.

### Rate limit (429 Too Many Requests)
- Implement client-side rate limiting at 80% of the published API limit.
- Batch requests where the API supports it (e.g., bulk customer creation).
- Distribute requests across multiple API keys if you have them.
- Cache responses for read-heavy endpoints.

### Webhook delivery failures
- Most providers retry automatically with exponential backoff.
- Verify your webhook endpoint is publicly reachable and returns 2xx in under 5 seconds.
- Make webhook handlers idempotent -- handle the same event arriving twice.
- Check webhook signature verification is not failing due to wrong secret.

### Card declines (insufficient_funds, card_declined)
- Not actionable from your side -- these are correct merchant-side responses.
- Track the rate over time; if it suddenly spikes, check for fraud patterns.

## Customer communication
- For widespread outages, post a status banner on the checkout page.
- For individual failures, show actionable error messages: "Your card was declined -- please try another payment method."
- Never expose internal error details (full provider response, API keys, internal trace ids).

## Escalation
- Payments team on-call rotation
- Provider account manager (for sustained outages > 30 min)
- Finance team (for charge reconciliation issues)
