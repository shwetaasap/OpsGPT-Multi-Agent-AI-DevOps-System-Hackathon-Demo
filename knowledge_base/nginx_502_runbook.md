# Nginx 502 Bad Gateway Runbook

Triggers: 502 Bad Gateway, 504 Gateway Timeout, upstream connect errors, ingress timeouts, proxy errors, gateway timeouts on payment/API endpoints.

## Quick Checks
1. Verify the upstream service is running and listening on the expected port.
2. Check ingress controller logs for "upstream timed out" or "connect() failed" errors.
3. Confirm the upstream service is in the load balancer's healthy pool.
4. Look at the upstream service's response time over the last 15 minutes.

## Common Causes
- The upstream application crashed or is restarting.
- The upstream is overloaded and unable to accept new connections.
- A firewall or network policy is blocking traffic between proxy and upstream.
- The upstream's readiness probe is failing intermittently.
- TLS handshake issues between proxy and upstream.

## Remediation Steps
1. Confirm the upstream service is up and accepting connections.
2. Restart the upstream service if it appears stuck or unresponsive.
3. Increase the proxy's upstream timeout if the work is genuinely long-running.
4. Scale the upstream horizontally if it is overloaded.
5. Verify the network path between proxy and upstream is open.
6. If using a payment or third-party gateway upstream, check the provider's status page.

## Follow-up
- Add an alert for upstream 5xx rate above 1% over 5 minutes.
- Implement circuit breakers in the proxy so a sick upstream is isolated quickly.
- Add retry-with-backoff at the proxy layer for idempotent requests.

## Escalation
- Platform on-call for ingress/proxy issues.
- Service owner on-call for upstream application issues.
