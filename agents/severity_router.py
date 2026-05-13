"""Severity Router agent.

Runs immediately after the classifier and inspects the classified incidents
plus the raw log text to decide which downstream path the workflow should
take. The output is a set of routing fields merged into the shared State,
plus a string used by the LangGraph conditional edge to pick the next node.

Design choices:
  - PURE PYTHON. No LLM call. Deterministic, fast, testable, doesn't burn
    OpenRouter tokens, and the routing logic is auditable.
  - The aggregate severity is the MAX severity across all incidents; if no
    incidents exist we fall back to keyword inference over the raw logs.
  - We always populate every routing field with a safe default so downstream
    nodes never trip on a missing key.
"""
from __future__ import annotations

from typing import Iterable, Optional

from .models import State

# Canonical 5-level severity scale used by the router.
# Higher index = more severe.
SEVERITY_ORDER: list[str] = ["info", "low", "medium", "high", "critical"]

# The classifier currently uses the legacy 4-level scale (info/warn/high/critical).
# We normalize legacy values to the canonical scale.
_LEGACY_NORMALIZATION = {
    "warn": "medium",
    "warning": "medium",
}

# --- Keyword maps used to infer severity from raw log text ----------------
# Order matters: we check from MOST severe down. Keep keywords lowercase.
CRITICAL_KEYWORDS = [
    "outage", "service unavailable", "payment failure", "502", "503", "504",
    "5xx", "crashloopbackoff", "connection refused", "database unavailable",
    "error rate above threshold", " down", " fatal", "panic", "data loss",
]
HIGH_KEYWORDS = [
    "database connection", "connection pool", "memory leak", "cpu saturation",
    "oomkilled", "repeated error", "timeout exceeded", "exception",
]
MEDIUM_KEYWORDS = [
    "disk usage", "latency", "retry", "warning", "degraded", "slow response",
]
LOW_KEYWORDS = [
    "deprecated", "minor", "non-critical",
]
INFO_KEYWORDS = [
    "health check", "started", "startup", "success", "200 ok", "heartbeat",
]


def _normalize(level: Optional[str]) -> str:
    """Map legacy/unknown severity strings to the canonical 5-level scale."""
    if not level:
        return "info"
    lvl = str(level).strip().lower()
    lvl = _LEGACY_NORMALIZATION.get(lvl, lvl)
    return lvl if lvl in SEVERITY_ORDER else "info"


def _max_severity(levels: Iterable[str]) -> str:
    """Return the most severe level from an iterable, defaulting to 'info'."""
    best_idx = -1
    for lvl in levels:
        try:
            idx = SEVERITY_ORDER.index(_normalize(lvl))
        except ValueError:
            continue
        if idx > best_idx:
            best_idx = idx
    return SEVERITY_ORDER[best_idx] if best_idx >= 0 else "info"


def _infer_severity_from_text(text: str) -> str:
    """Keyword-based severity inference. Used when no classifier output exists."""
    if not text:
        return "info"
    haystack = text.lower()
    if any(k in haystack for k in CRITICAL_KEYWORDS):
        return "critical"
    if any(k in haystack for k in HIGH_KEYWORDS):
        return "high"
    if any(k in haystack for k in MEDIUM_KEYWORDS):
        return "medium"
    if any(k in haystack for k in LOW_KEYWORDS):
        return "low"
    if any(k in haystack for k in INFO_KEYWORDS):
        return "info"
    return "info"


def _infer_incident_type(state: State, severity: str) -> str:
    """Pick a short slug describing the dominant incident kind.

    Cheap heuristic: pull the first incident's error_type if available;
    otherwise derive from log keywords.
    """
    incidents = state.get("incidents") or []
    if incidents:
        first = incidents[0]
        et = getattr(first, "error_type", None) or "unknown"
        return str(et).strip().lower().replace(" ", "_") or "unknown_incident"

    text = (state.get("raw_logs") or "").lower()
    if "payment" in text:
        return "payment_gateway_issue"
    if "database" in text or "db " in text:
        return "database_issue"
    if "disk" in text:
        return "disk_capacity_issue"
    if "login" in text or "auth" in text:
        return "auth_issue"
    return f"{severity}_event"


def _build_reason(severity: str, state: State) -> str:
    """Build a human-readable routing reason."""
    incidents = state.get("incidents") or []
    if incidents:
        # Pull a couple of evidence snippets to make the reason concrete.
        names = [getattr(i, "error_type", "incident") for i in incidents[:3]]
        return (
            f"{len(incidents)} incident(s) detected (top categories: "
            f"{', '.join(names)}); aggregate severity = {severity}."
        )
    return f"No structured incidents; severity inferred from log keywords as {severity}."


def severity_router_node(state: State) -> dict:
    """LangGraph node — populate routing metadata in state.

    Always returns the full set of routing fields so downstream nodes (and
    the UI) can rely on them being present.
    """
    incidents = state.get("incidents") or []

    # 1. Aggregate severity: prefer per-incident severity, fall back to text.
    if incidents:
        severity = _max_severity(getattr(i, "severity", "info") for i in incidents)
    else:
        severity = _infer_severity_from_text(state.get("raw_logs", ""))

    # 2. Decide routing path + flags from severity.
    if severity in ("critical", "high"):
        routing_path = "critical_deep_analysis_rag_validation_approval"
        flags = dict(
            requires_deep_analysis=True,
            requires_rag=True,
            requires_human_approval=True,
            requires_ticket=True,
            requires_notification=True,
        )
    elif severity == "medium":
        routing_path = "medium_rag_remediation_validation"
        flags = dict(
            requires_deep_analysis=False,
            requires_rag=True,
            requires_human_approval=False,
            requires_ticket=False,
            requires_notification=False,
        )
    elif severity == "low":
        routing_path = "low_standard_remediation_summary"
        flags = dict(
            requires_deep_analysis=False,
            requires_rag=False,
            requires_human_approval=False,
            requires_ticket=False,
            requires_notification=False,
        )
    else:  # info
        routing_path = "info_summary_only"
        flags = dict(
            requires_deep_analysis=False,
            requires_rag=False,
            requires_human_approval=False,
            requires_ticket=False,
            requires_notification=False,
        )

    incident_type = _infer_incident_type(state, severity)
    reason = _build_reason(severity, state)

    # Append to execution trace so the UI can render the path.
    trace = list(state.get("execution_path") or [])
    trace.append("severity_router")

    return {
        "severity": severity,
        "incident_type": incident_type,
        "routing_path": routing_path,
        "routing_reason": reason,
        "execution_path": trace,
        # Initialize retry counter so the validator loop has a starting point.
        "retry_count": int(state.get("retry_count", 0) or 0),
        **flags,
    }


def route_by_severity(state: State) -> str:
    """LangGraph conditional edge — return the NEXT node name based on severity.

    The graph wires this to four possible branches. Keeping the function
    purely a string-returner (no state mutation) is the LangGraph convention.
    """
    severity = _normalize(state.get("severity"))
    if severity in ("critical", "high"):
        return "deep_analysis"
    if severity == "medium":
        return "rag_retriever"
    if severity == "low":
        return "remediate"
    # info → bypass remediation entirely; go straight to the summary builder.
    return "summary_report"
