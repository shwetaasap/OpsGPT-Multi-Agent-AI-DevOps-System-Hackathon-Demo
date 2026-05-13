"""Validator / Critic agent.

Runs immediately after the remediation node. It inspects each generated Fix
against the routing metadata produced by the severity router and returns a
structured verdict:
  - approved        → continue to cookbook + report
  - needs_revision  → loop back to remediation (max 2 retries)
  - escalate        → human approval / final report with warning

Like the severity router, this is intentionally PURE PYTHON. We want
deterministic, fast, free, testable validation logic that doesn't depend on
the LLM. The validator essentially encodes "what does a good remediation
look like" as a checklist.
"""
from __future__ import annotations

from typing import Any

from .models import State

MAX_RETRIES = 2

# Generic / hand-wavy phrasing that should not survive a critical-severity
# review. If the rationale contains any of these AND severity is high+,
# we treat it as a sign the remediation is too vague.
GENERIC_PHRASES = [
    "investigate the issue",
    "look into the problem",
    "check the logs",
    "as appropriate",
    "if applicable",
    "do something",
    "fix the bug",
    "tbd",
    "todo",
]

# Words that imply destructive / risky actions. If any of these appear in
# the steps for a high/critical incident WITHOUT a corresponding human
# approval requirement, we flag it.
DESTRUCTIVE_KEYWORDS = [
    "delete", "drop ", "truncate", "rm -rf", "force push", "wipe",
    "shutdown", "terminate", "rollback production",
]


def _fix_text(fix: Any) -> str:
    """Concatenate every text field on a Fix so we can grep for keywords."""
    rationale = getattr(fix, "rationale", "") or ""
    steps = getattr(fix, "steps", []) or []
    return " ".join([rationale, *steps]).lower()


def _evaluate_fix(fix: Any, severity: str) -> tuple[int, list[str]]:
    """Score one Fix and collect issues. Returns (deductions, issues)."""
    deductions = 0
    issues: list[str] = []

    rationale = (getattr(fix, "rationale", "") or "").strip()
    steps = getattr(fix, "steps", []) or []
    runbook_ref = getattr(fix, "runbook_ref", None)
    text = _fix_text(fix)

    # 1. Root cause hypothesis must exist.
    if len(rationale) < 15:
        issues.append(f"{getattr(fix, 'incident_id', '?')}: missing or trivial root cause hypothesis")
        deductions += 2

    # 2. Clear remediation steps.
    if not steps or len(steps) < 2:
        issues.append(f"{getattr(fix, 'incident_id', '?')}: remediation steps too short")
        deductions += 2

    # 3. Generic / non-specific phrasing for severe incidents.
    if severity in ("critical", "high") and any(p in text for p in GENERIC_PHRASES):
        issues.append(
            f"{getattr(fix, 'incident_id', '?')}: remediation is too generic for "
            f"{severity} severity"
        )
        deductions += 2

    # 4. Runbook evidence is preferred for medium incidents. Critical/high
    # evidence is checked with the full state below because RAG compliance can
    # satisfy the requirement even if the LLM forgot runbook_ref.
    if severity == "medium" and not runbook_ref:
        issues.append(
            f"{getattr(fix, 'incident_id', '?')}: missing runbook/RAG reference"
        )
        deductions += 1

    # 5. Escalation guidance for critical/high.
    if severity in ("critical", "high") and not any(
        kw in text for kw in ["escalat", "page", "on-call", "oncall", "sre", "incident commander"]
    ):
        issues.append(
            f"{getattr(fix, 'incident_id', '?')}: no escalation guidance for "
            f"{severity} incident"
        )
        deductions += 2

    # 6. Destructive action without explicit human-approval mention.
    if any(kw in text for kw in DESTRUCTIVE_KEYWORDS) and "approv" not in text:
        issues.append(
            f"{getattr(fix, 'incident_id', '?')}: potentially destructive action without "
            f"approval gate"
        )
        deductions += 2

    return deductions, issues


def _rag_evidence_issues(state: State, severity: str, fixes: dict[str, Any]) -> list[str]:
    """Return evidence issues that should block severe remediations.

    The remediation node writes rag_compliance entries when RAG runs. Tests and
    older callers may only provide Fix.runbook_ref, so this accepts either a
    concrete runbook reference or an "ok" compliance verdict as evidence.
    """
    if severity not in ("critical", "high"):
        return []

    compliance_by_id = {
        entry.get("incident_id"): entry
        for entry in (state.get("rag_compliance") or [])
        if isinstance(entry, dict)
    }

    issues: list[str] = []
    for incident_id, fix in fixes.items():
        compliance = compliance_by_id.get(incident_id)
        has_runbook_ref = bool(getattr(fix, "runbook_ref", None))
        has_ok_compliance = bool(compliance and compliance.get("status") == "ok")

        if not (has_runbook_ref or has_ok_compliance):
            issues.append(
                f"{incident_id}: critical/high remediation requires RAG or "
                "runbook evidence before approval"
            )
        elif compliance and compliance.get("status") in ("warn", "fail"):
            issues.append(
                f"{incident_id}: RAG evidence check returned "
                f"{compliance.get('status')}"
            )

    return issues


def validate_remediation(state: State) -> dict:
    """LangGraph node — score the remediations and return a structured verdict.

    Always returns every validator field so the UI / report can rely on them.
    """
    severity = (state.get("severity") or "info").lower()
    fixes = state.get("remediations") or {}
    retry_count = int(state.get("retry_count", 0) or 0)

    # Edge case: nothing to validate.
    if not fixes:
        result = {
            "validator_status": "approved" if severity in ("low", "info") else "escalate",
            "quality_score": 6 if severity in ("low", "info") else 3,
            "issues_found": ["No remediations were produced by the remediation agent."]
            if severity not in ("low", "info") else [],
            "revision_instruction": "",
            "requires_human_approval": severity in ("critical", "high"),
            "escalation_required": severity in ("critical", "high"),
            "validation_reason": "No remediations to validate — routing on severity alone.",
            "retry_count": retry_count,
        }
        trace = list(state.get("execution_path") or [])
        trace.append("validator")
        result["execution_path"] = trace
        return result

    # Aggregate score across all fixes. Start at 10 and subtract deductions
    # (capped per-fix to keep one bad fix from collapsing the entire score).
    total_deductions = 0
    all_issues: list[str] = []
    for fix in fixes.values():
        d, iss = _evaluate_fix(fix, severity)
        total_deductions += min(d, 6)
        all_issues.extend(iss)

    evidence_issues = _rag_evidence_issues(state, severity, fixes)
    if evidence_issues:
        all_issues.extend(evidence_issues)

    # Average deduction so a clean batch of 5 fixes still scores well.
    avg_deduction = total_deductions / max(len(fixes), 1)
    quality_score = max(0, min(10, int(round(10 - avg_deduction))))

    # Decide verdict.
    if severity == "critical" and quality_score < 7:
        # Critical work that scored poorly should be reviewed by a human.
        status = "escalate" if quality_score <= 4 else "needs_revision"
    elif quality_score < 6:
        status = "needs_revision"
    else:
        status = "approved"

    # Severe incidents must be grounded before approval even when the rest of
    # the fix looks polished.
    if status == "approved" and evidence_issues:
        status = "needs_revision"

    # Cap retries: if we've already revised twice, escalate instead of looping.
    if status == "needs_revision" and retry_count >= MAX_RETRIES:
        status = "escalate"
        all_issues.append(
            f"Max retries ({MAX_RETRIES}) reached — escalating to human review."
        )

    # Build the human-readable verdict text.
    if status == "approved":
        revision_instruction = ""
        reason = (
            f"Remediation passes quality bar for {severity} severity "
            f"(score={quality_score}/10)."
        )
    elif status == "needs_revision":
        revision_instruction = (
            "Regenerate remediation with: more specific actions, cited runbook "
            "evidence, and explicit escalation guidance for high/critical incidents."
        )
        reason = (
            f"Remediation quality below threshold (score={quality_score}/10) "
            f"for {severity} severity — sending back for revision."
        )
    else:  # escalate
        revision_instruction = ""
        reason = (
            f"{severity.capitalize()} incident with quality score {quality_score}/10 — "
            f"requires human review before action."
        )

    requires_human_approval = severity in ("critical", "high") or status == "escalate"
    escalation_required = severity == "critical" or status == "escalate"

    # Increment retry counter ONLY when we're sending the work back.
    new_retry_count = retry_count + 1 if status == "needs_revision" else retry_count

    trace = list(state.get("execution_path") or [])
    trace.append("validator")

    return {
        "validator_status": status,
        "quality_score": quality_score,
        "issues_found": all_issues,
        "revision_instruction": revision_instruction,
        "requires_human_approval": requires_human_approval,
        "escalation_required": escalation_required,
        "validation_reason": reason,
        "retry_count": new_retry_count,
        "execution_path": trace,
    }


def route_after_validation(state: State) -> str:
    """LangGraph conditional edge — pick the next node from validator state.

    Branches:
      - "remediate"      → loop back for another remediation pass
      - "cookbook"       → happy path
      - "human_approval" → escalation / max retries reached
    """
    status = state.get("validator_status")
    retry_count = int(state.get("retry_count", 0) or 0)

    if status == "needs_revision" and retry_count <= MAX_RETRIES:
        # retry_count was already incremented inside validate_remediation, so
        # we compare with <= MAX_RETRIES here.
        return "remediate"
    if status == "escalate":
        return "human_approval"
    # approved (or any unexpected value) → continue down the happy path.
    return "cookbook"
