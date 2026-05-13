"""Remediation agent.

For EACH incident produced by the classifier, generate a Fix:
  - root cause rationale
  - ordered steps (plain English, no command-line)
  - risk level

NEW: for each incident we first retrieve the top-3 most relevant runbook
snippets from the knowledge base (via agents/rag.py) and inject them into
the prompt. This grounds the LLM in our team's specific procedures instead
of generic patterns -- the core RAG (Retrieval-Augmented Generation) move.

NEW: severity-aware RAG policy. The policy (defined in models.py
SEVERITY_RAG_POLICY) drives both:
  1. The prompt -- the LLM is told whether evidence is mandatory for this
     severity so it works harder to ground its answer.
  2. A post-check -- after the fix is produced, we compute a compliance
     verdict (ok / warn / fail) per incident and write it to graph state.

Beyond per-incident retrieval, this node also AGGREGATES every retrieval
across all incidents and writes a structured RAG payload back to graph state:
  - retrieved_runbooks (deduped list of snippets)
  - rag_context (concatenated snippet text)
  - rag_sources (unique filenames)
  - rag_confidence (high / medium / low / none)
  - rag_compliance (per-incident severity-policy verdict)
"""
from .config import get_llm
from .models import (
    Fix,
    Incident,
    RagCompliance,
    RetrievedSnippet,
    SEVERITY_RAG_POLICY,
    State,
)
from .rag import build_rag_payload


# Human-readable rendering of the policy used in the prompt for each severity.
POLICY_BLURB = {
    "mandatory": (
        "EVIDENCE IS MANDATORY for this severity. You MUST cite a runbook in "
        "runbook_ref. If no runbook applies, choose the closest match and "
        "explicitly state the gap in the rationale."
    ),
    "strongly_preferred": (
        "EVIDENCE IS STRONGLY PREFERRED. Cite a runbook in runbook_ref unless "
        "no retrieved snippet is even loosely relevant."
    ),
    "preferred": (
        "EVIDENCE IS PREFERRED. Cite a runbook when one applies; otherwise "
        "rely on first-principles reasoning."
    ),
    "optional": (
        "EVIDENCE IS OPTIONAL. Use a runbook if relevant, otherwise reason "
        "from first principles."
    ),
}


PROMPT = """You are a helpful engineer explaining a fix to a teammate.

Given the incident below, propose a concrete fix.

Style rules for the steps:
- Use plain English. Avoid jargon and tool-specific commands.
- Each step should be a short sentence describing WHAT to do, not HOW.
- 3 to 6 steps total. Order them by what to do first.
- Anyone on a small dev team (frontend, backend, QA, PM) should follow it.

=== RAG POLICY (severity = {severity}) ===
{policy_blurb}

PRIORITIZE the team's own runbooks below over generic advice when they apply.
If a runbook snippet covers this incident, follow its specific guidance and
cite the source filename in runbook_ref (e.g. "nginx_502_runbook").

Return rationale (root cause in 1-2 sentences), ordered steps, risk level,
and a runbook_ref slug if applicable.

=== TEAM RUNBOOKS (retrieved for this incident, retrieval confidence: {confidence}) ===
{rag_context}

=== INCIDENT ===
id: {id}
service: {service}
error_type: {error_type}
severity: {severity}
summary: {summary}
evidence:
{evidence}
"""


def _build_query(incident: Incident) -> str:
    """Build a search query from the incident's most signal-rich fields."""
    return f"{incident.error_type} {incident.summary} {incident.service}"


def remediate_one(incident: Incident) -> tuple[Fix, dict]:
    """Generate a Fix and return it along with the RAG payload used."""
    payload = build_rag_payload(_build_query(incident), k=3)
    requirement = SEVERITY_RAG_POLICY.get(incident.severity, "optional")

    llm = get_llm(max_tokens=2048, structured_output_schema=Fix)
    fix = llm.invoke(PROMPT.format(
        policy_blurb=POLICY_BLURB[requirement],
        confidence=payload["rag_confidence"],
        rag_context=payload["rag_context"],
        id=incident.id,
        service=incident.service,
        error_type=incident.error_type,
        severity=incident.severity,
        summary=incident.summary,
        evidence=incident.evidence[:2000],
    ))
    return fix, payload


def _check_compliance(
    incident: Incident, fix: Fix, payload: dict
) -> RagCompliance:
    """Check whether the produced fix meets the severity-based RAG policy.

    Evidence is considered "present" when EITHER:
      - the LLM cited a runbook (runbook_ref is set) AND retrieval was non-empty, OR
      - retrieval confidence is medium or high (we found a relevant runbook
        even if the LLM forgot to cite it).

    Verdicts:
      critical: must have evidence -> fail otherwise
      high:     should have evidence -> warn otherwise
      warn:     prefer evidence -> warn if confidence is "none"
      info:     never required -> always ok
    """
    requirement = SEVERITY_RAG_POLICY.get(incident.severity, "optional")
    confidence = payload["rag_confidence"]
    has_citation = bool(fix.runbook_ref) and bool(payload.get("retrieved_runbooks"))
    has_strong_retrieval = confidence in ("medium", "high")
    has_evidence = has_citation or has_strong_retrieval

    if requirement == "mandatory":
        if has_evidence:
            return RagCompliance(
                incident_id=incident.id,
                severity=incident.severity,
                requirement=requirement,
                status="ok",
                reason="Critical severity requires runbook evidence; evidence is present.",
                rag_confidence=confidence,
                runbook_ref=fix.runbook_ref,
            )
        return RagCompliance(
            incident_id=incident.id,
            severity=incident.severity,
            requirement=requirement,
            status="fail",
            reason=(
                "Critical severity requires runbook evidence but no relevant "
                "runbook was retrieved or cited. Add a runbook to knowledge_base/ "
                "covering this scenario."
            ),
            rag_confidence=confidence,
            runbook_ref=fix.runbook_ref,
        )

    if requirement == "strongly_preferred":
        if has_evidence:
            return RagCompliance(
                incident_id=incident.id,
                severity=incident.severity,
                requirement=requirement,
                status="ok",
                reason="High severity strongly prefers runbook evidence; evidence is present.",
                rag_confidence=confidence,
                runbook_ref=fix.runbook_ref,
            )
        return RagCompliance(
            incident_id=incident.id,
            severity=incident.severity,
            requirement=requirement,
            status="warn",
            reason=(
                "High severity strongly prefers runbook evidence but none was "
                "retrieved. Consider adding a runbook covering this scenario."
            ),
            rag_confidence=confidence,
            runbook_ref=fix.runbook_ref,
        )

    if requirement == "preferred":
        if confidence != "none" or has_citation:
            return RagCompliance(
                incident_id=incident.id,
                severity=incident.severity,
                requirement=requirement,
                status="ok",
                reason="Runbook evidence present (preferred for this severity).",
                rag_confidence=confidence,
                runbook_ref=fix.runbook_ref,
            )
        return RagCompliance(
            incident_id=incident.id,
            severity=incident.severity,
            requirement=requirement,
            status="warn",
            reason="No runbook matched. Evidence is preferred but not required at this severity.",
            rag_confidence=confidence,
            runbook_ref=fix.runbook_ref,
        )

    # optional (info)
    return RagCompliance(
        incident_id=incident.id,
        severity=incident.severity,
        requirement=requirement,
        status="ok",
        reason="Runbook evidence is not required at this severity.",
        rag_confidence=confidence,
        runbook_ref=fix.runbook_ref,
    )


def _confidence_rank(label: str) -> int:
    return {"none": 0, "low": 1, "medium": 2, "high": 3}.get(label, 0)


def remediate(state: State) -> dict:
    """LangGraph node: produce remediations + aggregated RAG payload + compliance."""
    fixes: dict[str, Fix] = {}
    compliance_list: list[RagCompliance] = []
    all_snippets: list[RetrievedSnippet] = []
    seen_keys: set[tuple[str, str]] = set()
    contexts: list[str] = []
    sources_in_order: list[str] = []
    seen_sources: set[str] = set()
    max_confidence = "none"

    for inc in state["incidents"]:
        fix, payload = remediate_one(inc)
        fixes[inc.id] = fix
        compliance_list.append(_check_compliance(inc, fix, payload))

        for snip in payload["retrieved_runbooks"]:
            key = (snip["source"], snip["matched_section"])
            if key not in seen_keys:
                seen_keys.add(key)
                all_snippets.append(snip)

        if payload["rag_context"] and payload["rag_context"] != "(no specific runbook matched)":
            contexts.append(f"# Context for {inc.id}\n{payload['rag_context']}")

        for src in payload["rag_sources"]:
            if src not in seen_sources:
                seen_sources.add(src)
                sources_in_order.append(src)

        if _confidence_rank(payload["rag_confidence"]) > _confidence_rank(max_confidence):
            max_confidence = payload["rag_confidence"]

    all_snippets.sort(key=lambda s: s["score"], reverse=True)

    return {
        "remediations": fixes,
        "retrieved_runbooks": all_snippets,
        "rag_context": "\n\n===\n\n".join(contexts) if contexts else "(no specific runbook matched)",
        "rag_sources": sources_in_order,
        "rag_confidence": max_confidence,
        "rag_compliance": compliance_list,
    }
