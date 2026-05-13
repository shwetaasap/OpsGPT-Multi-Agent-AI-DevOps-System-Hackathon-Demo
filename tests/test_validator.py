"""Tests for the validator / critic agent.

Deterministic, no LLM calls. We hand the validator a fake remediations dict
and assert the verdict it returns.
"""
from typing import Optional
from agents.models import Fix
from agents.validator import (
    validate_remediation,
    route_after_validation,
    MAX_RETRIES,
)


def _fix(
    incident_id: str = "INC-001",
    rationale: str = "Root cause identified",
    steps=None,
    risk: str = "medium",
    runbook_ref: Optional[str] = None,
) -> Fix:
    return Fix(
        incident_id=incident_id,
        rationale=rationale,
        steps=steps or ["Step 1", "Step 2", "Step 3"],
        risk=risk,
        runbook_ref=runbook_ref,
    )


# ---------------------------------------------------------------------------
# Critical-incident validation logic
# ---------------------------------------------------------------------------

def test_critical_without_escalation_guidance_is_not_approved():
    """Critical fixes lacking escalation language should not slip through."""
    fix = _fix(
        rationale="Investigate the issue and check the logs for the error",
        steps=["Investigate the issue", "Check the logs", "Restart"],
        runbook_ref=None,
    )
    state = {
        "severity": "critical",
        "remediations": {"INC-001": fix},
    }
    out = validate_remediation(state)
    assert out["validator_status"] in ("needs_revision", "escalate")
    assert out["requires_human_approval"] is True
    assert out["escalation_required"] is True
    assert out["quality_score"] < 7
    # At least one issue should call out missing escalation or generic phrasing.
    assert any("escalat" in i.lower() or "generic" in i.lower() for i in out["issues_found"])


def test_good_critical_remediation_is_approved():
    fix = _fix(
        rationale=(
            "Upstream payment-api pods are crash-looping due to a misconfigured "
            "Stripe webhook secret. Page the on-call SRE and escalate."
        ),
        steps=[
            "Page on-call SRE incident commander immediately",
            "Roll back the latest payment-api deployment",
            "Verify the STRIPE_WEBHOOK_SECRET env variable is set",
            "Restart pods and confirm health checks pass",
        ],
        runbook_ref="payment-gateway-outage",
    )
    state = {
        "severity": "critical",
        "remediations": {"INC-001": fix},
    }
    out = validate_remediation(state)
    assert out["validator_status"] == "approved"
    assert out["quality_score"] >= 7
    # Critical incidents always require human approval downstream.
    assert out["requires_human_approval"] is True


def test_polished_critical_without_rag_evidence_needs_revision():
    """Critical fixes cannot be approved unless runbook/RAG evidence is present."""
    fix = _fix(
        rationale=(
            "Payment API is returning gateway errors after a dependency failure. "
            "Page on-call SRE and escalate before production action."
        ),
        steps=[
            "Page on-call SRE incident commander immediately",
            "Check the payment provider status page",
            "Confirm customer impact and error rate",
            "Prepare rollback after approval",
        ],
        runbook_ref=None,
    )
    state = {
        "severity": "critical",
        "remediations": {"INC-001": fix},
        "retry_count": 0,
    }
    out = validate_remediation(state)
    assert out["validator_status"] == "needs_revision"
    assert any("rag" in i.lower() or "runbook" in i.lower() for i in out["issues_found"])


def test_critical_with_ok_rag_compliance_can_be_approved_without_runbook_ref():
    fix = _fix(
        rationale=(
            "Payment API is returning gateway errors after a dependency failure. "
            "Page on-call SRE and escalate before production action."
        ),
        steps=[
            "Page on-call SRE incident commander immediately",
            "Check the payment provider status page",
            "Confirm customer impact and error rate",
            "Prepare rollback after approval",
        ],
        runbook_ref=None,
    )
    state = {
        "severity": "critical",
        "remediations": {"INC-001": fix},
        "rag_compliance": [
            {
                "incident_id": "INC-001",
                "status": "ok",
            }
        ],
    }
    out = validate_remediation(state)
    assert out["validator_status"] == "approved"


# ---------------------------------------------------------------------------
# Lower-severity behavior
# ---------------------------------------------------------------------------

def test_medium_with_runbook_is_approved():
    fix = _fix(
        rationale="Disk approaching capacity due to retained build artifacts.",
        steps=[
            "Identify the largest directories under /var/cache",
            "Run the cleanup job to remove old artifacts",
            "Add a scheduled job to keep usage below 80%",
        ],
        runbook_ref="disk-full-cleanup",
    )
    state = {"severity": "medium", "remediations": {"INC-001": fix}}
    out = validate_remediation(state)
    assert out["validator_status"] == "approved"
    assert out["requires_human_approval"] is False


def test_info_with_no_remediations_is_approved():
    """Info-only logs may have no remediations and that's fine."""
    state = {"severity": "info", "remediations": {}}
    out = validate_remediation(state)
    assert out["validator_status"] == "approved"


# ---------------------------------------------------------------------------
# Retry loop behavior
# ---------------------------------------------------------------------------

def test_needs_revision_increments_retry_count():
    """A 'meh' critical fix (specific rationale + generic phrasing, no runbook,
    no escalation) should land in the needs_revision band and bump retry_count."""
    fix = _fix(
        rationale=(
            "Upstream payment service returning 502 errors due to a recent "
            "config change; needs a careful look."
        ),
        steps=[
            "Check the logs for any 502 patterns",
            "Investigate the issue with the upstream service",
            "Restart the affected pods if needed",
        ],
        runbook_ref=None,
    )
    state = {
        "severity": "critical",
        "remediations": {"INC-001": fix},
        "retry_count": 0,
    }
    out = validate_remediation(state)
    assert out["validator_status"] == "needs_revision"
    assert out["retry_count"] == 1
    assert route_after_validation({**state, **out}) == "remediate"


def test_retry_capped_at_max():
    """After MAX_RETRIES, even a 'just needs revision' verdict must escalate
    instead of looping back to remediation forever."""
    # Same fix as test_needs_revision_increments_retry_count — lands in the
    # needs_revision band on a fresh state (retry_count=0).
    fix = _fix(
        rationale=(
            "Upstream payment service returning 502 errors due to a recent "
            "config change; needs a careful look."
        ),
        steps=[
            "Check the logs for any 502 patterns",
            "Investigate the issue with the upstream service",
            "Restart the affected pods if needed",
        ],
        runbook_ref=None,
    )
    state = {
        "severity": "critical",
        "remediations": {"INC-001": fix},
        "retry_count": MAX_RETRIES,  # already retried twice
    }
    out = validate_remediation(state)
    # The validator should refuse a third revision and escalate instead.
    assert out["validator_status"] == "escalate"
    assert route_after_validation({**state, **out}) == "human_approval"


def test_route_after_validation_branches():
    assert route_after_validation({"validator_status": "approved"}) == "cookbook"
    assert route_after_validation({"validator_status": "escalate"}) == "human_approval"
    assert route_after_validation(
        {"validator_status": "needs_revision", "retry_count": 1}
    ) == "remediate"
    # Once retry_count exceeds MAX_RETRIES, the router refuses to loop —
    # it falls through to cookbook (and the validator itself would have
    # flipped status to "escalate" before this happened).
    next_node = route_after_validation(
        {"validator_status": "needs_revision", "retry_count": MAX_RETRIES + 5}
    )
    assert next_node != "remediate"
