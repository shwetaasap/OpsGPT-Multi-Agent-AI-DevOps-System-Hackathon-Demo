"""Shared Pydantic models used by every agent.

Pydantic = Python library that gives you typed data classes with automatic
validation. We use it here for two reasons:
  1. Type safety - every agent knows exactly what shape of data it gets/returns.
  2. Structured LLM output - we hand these classes to the LLM and it fills them
     in as JSON. The LLM is *forced* to produce data that matches the schema,
     which is much more reliable than parsing free-form text.
"""
from typing import Literal, TypedDict
from pydantic import BaseModel, Field

# Severity is a fixed set of strings - Literal restricts the allowed values.
Severity = Literal["info", "warn", "high", "critical"]

# RAG confidence band derived from the top retrieval score.
RagConfidence = Literal["high", "medium", "low", "none"]


class Incident(BaseModel):
    """One distinct problem detected in the logs."""
    id: str = Field(description="stable short id, e.g. INC-001")
    service: str = Field(description="affected service / namespace / component")
    error_type: str = Field(description="canonical category, e.g. App Crash, Disk Full")
    severity: Severity
    summary: str = Field(description="one-line human summary")
    evidence: str = Field(description="raw log lines or stack trace excerpt")
    first_seen: str | None = None


class Fix(BaseModel):
    """A proposed remediation for a single incident."""
    incident_id: str
    rationale: str = Field(description="why this fix addresses the root cause")
    steps: list[str] = Field(description="ordered remediation steps")
    risk: Literal["low", "medium", "high"]
    runbook_ref: str | None = None


class Checklist(BaseModel):
    """A consolidated runbook checklist covering all incidents."""
    title: str
    items: list[str]


class IncidentList(BaseModel):
    """Wrapper so the LLM returns a single object containing the list."""
    incidents: list[Incident]


class RetrievedSnippet(TypedDict):
    """One match from the knowledge base."""
    source: str           # filename, e.g. "nginx_502_runbook.md"
    matched_section: str  # the ## header
    content: str          # the snippet text
    score: float          # BM25 relevance score


# RAG policy by severity. Drives both the prompt instructions and the
# post-generation compliance check.
SEVERITY_RAG_POLICY = {
    "critical": "mandatory",            # missing evidence -> fail
    "high":     "strongly_preferred",   # missing evidence -> warn
    "warn":     "preferred",            # missing evidence -> soft warn
    "info":     "optional",             # missing evidence -> ok
}


class RagCompliance(TypedDict):
    """Per-incident verdict on whether the severity-based RAG policy is met."""
    incident_id: str
    severity: Severity
    requirement: str  # "mandatory" | "strongly_preferred" | "preferred" | "optional"
    status: str       # "ok" | "warn" | "fail"
    reason: str       # human-readable explanation
    rag_confidence: RagConfidence
    runbook_ref: str | None


class State(TypedDict, total=False):
    """The shared state object passed between every node in the LangGraph DAG.

    LangGraph merges partial dicts returned from each node into this state.
    `total=False` means every key is optional - nodes only fill in what they
    produce.
    """
    raw_logs: str                              # set by the UI before invoke()
    incidents: list[Incident]                  # set by classifier
    remediations: dict[str, Fix]               # set by remediation node
    cookbook: Checklist                        # set by cookbook node
    slack_thread_ts: str | None                # set by slack node
    slack_status: str                          # "sent_mock" | "prepared_mock" | "skipped"
    slack_channel: str | None
    slack_message_id: str | None
    slack_message_preview: str
    jira_status: str                           # "created_mock" | "skipped"
    jira_keys: list[str]                       # set by jira node
    jira_priority: str | None
    jira_summary: str
    jira_description_preview: str
    report_md: str                             # set by final report node

    # --- RAG payload (populated by remediation node) ---
    retrieved_runbooks: list[RetrievedSnippet] # all matches across incidents (deduped)
    rag_context: str                           # concatenated snippet text
    rag_sources: list[str]                     # unique source filenames
    rag_confidence: RagConfidence              # high / medium / low / none
    rag_compliance: list[RagCompliance]        # severity-policy verdict per incident

    # --- Severity routing fields (set by severity_router) ---------------
    # `severity` here is the AGGREGATE severity for the whole batch of logs
    # (per-incident severity still lives on each Incident). The router
    # normalizes the legacy 4-level scale to a canonical 5-level string
    # (critical / high / medium / low / info).
    severity: str
    incident_type: str
    routing_path: str
    routing_reason: str
    requires_deep_analysis: bool
    requires_rag: bool
    requires_human_approval: bool
    requires_ticket: bool
    requires_notification: bool
    rag_snippet_count: int

    # --- Validator / critic fields (set by validator agent) -------------
    validator_status: str             # "approved" | "needs_revision" | "escalate"
    quality_score: int                # 0-10
    issues_found: list[str]
    revision_instruction: str
    escalation_required: bool
    validation_reason: str
    retry_count: int

    # --- Human approval / execution trace -------------------------------
    human_approval_status: str        # "required" | "approved" | "skipped"
    execution_path: list[str]         # ordered list of node names visited
