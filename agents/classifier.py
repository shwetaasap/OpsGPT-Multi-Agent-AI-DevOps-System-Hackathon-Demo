"""Classifier agent.

Reads raw log text and produces a list of distinct Incident objects.
This is the FIRST node in the LangGraph DAG — every other agent depends
on its output.

How it works:
  1. Build a prompt that includes the log text.
  2. Ask the LLM, but force the answer to match the IncidentList schema
     (structured output — the LLM literally cannot return malformed JSON).
  3. Return a partial state dict; LangGraph merges it into the global state.
"""
from .config import get_llm
from .models import IncidentList, State

# The prompt is a string template — {logs} gets replaced at runtime.
# Triple-quoted so we can keep nice multi-line formatting.
PROMPT = """You are an experienced engineer reviewing application logs.

Extract every distinct incident from the logs below.

Rules:
- Dedupe near-duplicates: same service + same error type within 5 minutes counts as one incident.
- Severity scale: info < warn < high < critical.
  - critical: outage, data loss risk, security breach, payments failing widely.
  - high: a key feature broken or degraded for many users.
  - warn: transient errors, slow responses, retries working.
  - info: noise.
- Assign stable ids: INC-001, INC-002, ...
- Use simple, descriptive error_type labels in plain English. Examples:
  "App Crash", "Out of Memory", "Slow Database Query", "Disk Full",
  "Login Brute Force", "Payment Gateway Timeout", "Email Delivery Failure",
  "Rate Limited", "Certificate Expiring", "Webhook Delivery Failed".
  Avoid Kubernetes-specific terms like "CrashLoopBackOff" or "OOMKilled" unless
  the logs literally use them.
- summary should be one human-friendly sentence anyone on the team can read.

LOGS:
---
{logs}
---
"""


def classify(state: State) -> dict:
    """LangGraph node: read raw_logs from state, return {'incidents': [...]}.

    LangGraph automatically calls this with the current state and merges the
    returned dict back into state. We never mutate state directly.
    """
    # Get an LLM bound to the IncidentList schema — output is guaranteed to
    # be a valid IncidentList instance.
    llm = get_llm(max_tokens=4096, structured_output_schema=IncidentList)

    # Slice logs to 50k chars to stay within the model's context window
    # AND to keep cost predictable. Most real log dumps under inspection
    # are well under this size.
    result: IncidentList = llm.invoke(PROMPT.format(logs=state["raw_logs"][:50000]))

    # Returning a partial state — LangGraph merges this into the shared State.
    return {"incidents": result.incidents}
