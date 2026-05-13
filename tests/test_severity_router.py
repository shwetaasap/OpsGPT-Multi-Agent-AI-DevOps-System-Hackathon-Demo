"""Tests for the severity router.

These are pure-Python unit tests — no LLM calls. We hand the router a
hand-crafted state dict and assert the routing decision.
"""
from agents.models import Incident
from agents.severity_router import (
    severity_router_node,
    route_by_severity,
    _infer_severity_from_text,
)


def _incident(severity: str, summary: str = "x", error_type: str = "App Crash") -> Incident:
    """Tiny helper — build a minimal valid Incident."""
    return Incident(
        id="INC-001",
        service="api",
        error_type=error_type,
        severity=severity,
        summary=summary,
        evidence="...",
    )


# ---------------------------------------------------------------------------
# Severity inference from raw log text
# ---------------------------------------------------------------------------

def test_502_or_crashloopbackoff_is_critical():
    assert _infer_severity_from_text("HTTP 502 Bad Gateway from upstream") == "critical"
    assert _infer_severity_from_text("payment-api in CrashLoopBackOff") == "critical"
    assert _infer_severity_from_text("connection refused to db-primary") == "critical"


def test_db_connection_pool_is_high():
    assert _infer_severity_from_text("database connection pool exhausted") == "high"
    assert _infer_severity_from_text("OOMKilled by kernel") == "high"


def test_disk_usage_warning_is_medium():
    assert _infer_severity_from_text("Warning: disk usage at 92%") == "medium"
    assert _infer_severity_from_text("latency spike on /search endpoint") == "medium"


def test_health_check_is_info():
    assert _infer_severity_from_text("health check 200 OK") == "info"
    assert _infer_severity_from_text("Application started successfully") == "info"


# ---------------------------------------------------------------------------
# Full router node behavior
# ---------------------------------------------------------------------------

def test_router_critical_path():
    state = {"incidents": [_incident("critical", "payment outage")]}
    out = severity_router_node(state)
    assert out["severity"] == "critical"
    assert out["routing_path"] == "critical_deep_analysis_rag_validation_approval"
    assert out["requires_deep_analysis"] is True
    assert out["requires_rag"] is True
    assert out["requires_human_approval"] is True
    assert out["requires_ticket"] is True
    assert out["requires_notification"] is True
    assert route_by_severity(out) == "deep_analysis"


def test_router_normalizes_legacy_warn_to_medium():
    """Existing classifier may emit `warn`; router must normalize to medium."""
    state = {"incidents": [_incident("warn", "disk getting full")]}
    out = severity_router_node(state)
    assert out["severity"] == "medium"
    assert out["routing_path"] == "medium_rag_remediation_validation"
    assert out["requires_rag"] is True
    assert out["requires_human_approval"] is False
    assert out["requires_ticket"] is False
    assert out["requires_notification"] is False
    assert route_by_severity(out) == "rag_retriever"


def test_router_low_routes_to_remediate():
    """Low severity is inferred from raw_logs keywords (the team's Severity
    Literal restricts per-incident values to info/warn/high/critical, so we
    exercise this path via the keyword-inference fallback)."""
    state = {"raw_logs": "minor non-critical issue logged", "incidents": []}
    out = severity_router_node(state)
    assert out["severity"] == "low"
    assert route_by_severity(out) == "remediate"
    assert out["requires_human_approval"] is False
    assert out["requires_ticket"] is False
    assert out["requires_notification"] is False


def test_router_info_routes_to_summary():
    state = {"raw_logs": "health check 200 OK", "incidents": []}
    out = severity_router_node(state)
    assert out["severity"] == "info"
    assert route_by_severity(out) == "summary_report"
    assert out["requires_notification"] is False


def test_router_max_severity_across_incidents():
    """Aggregate severity should be the MAX of all incident severities."""
    state = {
        "incidents": [
            _incident("warn"),
            _incident("high"),
            _incident("info"),
        ]
    }
    out = severity_router_node(state)
    assert out["severity"] == "high"
    assert route_by_severity(out) == "deep_analysis"


def test_router_falls_back_to_text_when_no_incidents():
    """Router must still produce a decision if classifier returned nothing."""
    state = {"raw_logs": "fatal: connection refused to upstream"}
    out = severity_router_node(state)
    assert out["severity"] == "critical"
    assert "incidents" not in out  # router doesn't fabricate incidents
    assert out["requires_human_approval"] is True


def test_router_initializes_retry_count():
    """Router should set retry_count to 0 if not already present."""
    state = {"incidents": [_incident("info")]}
    out = severity_router_node(state)
    assert out["retry_count"] == 0
