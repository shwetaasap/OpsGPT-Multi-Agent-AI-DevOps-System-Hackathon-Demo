"""LangGraph orchestrator — wires every agent together as a directed graph.

LangGraph mental model:
  - Nodes are functions: (State) -> partial_state_dict
  - Edges define the order: A -> B means "after A finishes, run B".
  - Conditional edges: a router function returns the NEXT node name, used
    when one node can fan out to several different paths.
  - State is a TypedDict shared across all nodes; each node's return dict
    is merged into it.
  - START and END are special sentinel nodes built into LangGraph.

DAG (with conditional routing — "?" denotes a conditional branch):

        START
          v
       classify
          v
     severity_router
          v
          ?  ── critical/high ──► deep_analysis ─► rag_retriever ─► remediate
          ?  ── medium ────────► rag_retriever ───────────────────► remediate
          ?  ── low ─────────────────────────────────────────────► remediate
          ?  ── info ──────────────────────────────────────────► summary_report
                                                                       v
                                                                     report
       remediate
          v
       validator
          ?  ── needs_revision (retry < 2) ──► remediate (loop)
          ?  ── escalate ──────────────────► human_approval
          ?  ── approved ──────────────────► cookbook
       cookbook
          v
     human_approval
          v
        slack
          v
         jira
          v
        report
          v
         END
"""
from langgraph.graph import StateGraph, START, END
from .models import State
from .classifier import classify
from .remediation import remediate
from .cookbook import synthesize
from .notifier import notify_slack, file_jira
from .severity_router import severity_router_node, route_by_severity
from .validator import validate_remediation, route_after_validation


# ---------------------------------------------------------------------------
# Lightweight stub nodes for the conditional branches.
# These are intentionally pure-Python placeholders so the graph runs without
# extra LLM calls or external services. Real implementations can replace them
# without changing the graph topology.
# ---------------------------------------------------------------------------

def deep_analysis(state: State) -> dict:
    """Stub deep analysis node for critical/high incidents.

    A real implementation would do extra correlation analysis, dependency
    mapping, etc. Here we just record that we passed through and surface a
    short marker the UI can show.
    """
    trace = list(state.get("execution_path") or [])
    trace.append("deep_analysis")
    return {
        "execution_path": trace,
        "requires_deep_analysis": True,
    }


def rag_retriever(state: State) -> dict:
    """RAG retriever node for medium+ incidents.

    The remediation agent already calls rag.retrieve() per-incident — this
    node sits *before* it on the graph to make the conditional RAG branch
    visible in the topology. We do an extra top-level retrieval against the
    raw logs so the trace shows real KB activity (best-effort: if the RAG
    module or knowledge base isn't available, we silently skip).
    """
    trace = list(state.get("execution_path") or [])
    trace.append("rag_retriever")
    snippet_count = 0
    try:
        from .rag import retrieve  # local import — RAG module is optional
        query = (state.get("raw_logs") or "")[:1000]
        snippets = retrieve(query, k=3)
        snippet_count = len(snippets)
    except Exception:
        # RAG module or KB missing — keep going; remediate has its own fallback.
        pass
    return {
        "execution_path": trace,
        "requires_rag": True,
        "rag_snippet_count": snippet_count,
    }


def summary_report(state: State) -> dict:
    """Lightweight summary builder for info-only logs.

    Skips remediation entirely and produces a placeholder cookbook so the
    final report node has something to render.
    """
    trace = list(state.get("execution_path") or [])
    trace.append("summary_report")
    # Use the existing Checklist model so we don't break the report builder.
    from .models import Checklist
    n = len(state.get("incidents") or [])
    placeholder = Checklist(
        title="Informational Log Summary",
        items=[f"{n} informational event(s) detected — no action required."],
    )
    return {
        "execution_path": trace,
        "cookbook": placeholder,
        # Make sure remediations dict exists so the report builder doesn't KeyError.
        "remediations": state.get("remediations") or {},
    }


def human_approval(state: State) -> dict:
    """Human-in-the-loop approval gate.

    For hackathon scope this is a *workflow control gate*: the node sets
    ``human_approval_status: "required"`` whenever the severity router or
    validator flagged ``requires_human_approval`` / ``escalation_required``,
    then continues so the demo runs end-to-end without blocking.

    The graph topology is identical to a production HITL setup — to make
    this gate truly blocking, swap the body for ``langgraph.types.interrupt``
    and resume the run when the operator clicks Approve in the UI / Slack.
    No edges need to change; the node already sits on the path between
    cookbook synthesis and the notification fan-out.
    """
    trace = list(state.get("execution_path") or [])
    trace.append("human_approval")
    if state.get("requires_human_approval") or state.get("escalation_required"):
        status = "required"
    else:
        status = "skipped"
    return {
        "execution_path": trace,
        "human_approval_status": status,
    }


# Wrap remediate / cookbook / notifier nodes so they update the execution
# trace too (one-line wrappers — keeps the original node logic untouched).
def remediate_traced(state: State) -> dict:
    out = remediate(state)
    trace = list(state.get("execution_path") or [])
    trace.append("remediate")
    out["execution_path"] = trace
    return out


def synthesize_traced(state: State) -> dict:
    out = synthesize(state)
    trace = list(state.get("execution_path") or [])
    trace.append("cookbook")
    out["execution_path"] = trace
    return out


def classify_traced(state: State) -> dict:
    out = classify(state)
    trace = list(state.get("execution_path") or [])
    trace.append("classify")
    out["execution_path"] = trace
    return out


def notify_slack_traced(state: State) -> dict:
    out = notify_slack(state) or {}
    trace = list(state.get("execution_path") or [])
    trace.append("slack")
    out["execution_path"] = trace
    return out


def file_jira_traced(state: State) -> dict:
    out = file_jira(state) or {}
    trace = list(state.get("execution_path") or [])
    trace.append("jira")
    out["execution_path"] = trace
    return out


def build_report(state: State) -> dict:
    """Final node: render everything as a single Markdown string for the UI.

    This is plain Python — no LLM call. We walk through the state and
    assemble a readable report including the new severity-routing and
    validator metadata.
    """
    lines = ["# Incident Analysis Report\n"]

    # --- Routing summary block (added by severity_router) ----------------
    if state.get("severity"):
        lines.append("## Routing Decision")
        lines.append(f"- **Severity:** {state.get('severity')}")
        lines.append(f"- **Incident type:** {state.get('incident_type', 'n/a')}")
        lines.append(f"- **Routing path:** `{state.get('routing_path', 'n/a')}`")
        lines.append(f"- **Routing reason:** {state.get('routing_reason', 'n/a')}")
        lines.append(
            f"- **Flags:** deep_analysis={state.get('requires_deep_analysis', False)}, "
            f"rag={state.get('requires_rag', False)}, "
            f"human_approval={state.get('requires_human_approval', False)}, "
            f"ticket={state.get('requires_ticket', False)}, "
            f"notification={state.get('requires_notification', False)}"
        )
        lines.append("")

    # --- Validator block (added by validator) ----------------------------
    if state.get("validator_status"):
        lines.append("## Validator / Critic Review")
        lines.append(f"- **Status:** {state.get('validator_status')}")
        lines.append(f"- **Quality score:** {state.get('quality_score', 'n/a')}/10")
        lines.append(f"- **Retry count:** {state.get('retry_count', 0)}")
        lines.append(f"- **Human approval required:** {state.get('requires_human_approval', False)}")
        lines.append(f"- **Escalation required:** {state.get('escalation_required', False)}")
        lines.append(f"- **Reason:** {state.get('validation_reason', 'n/a')}")
        issues = state.get("issues_found") or []
        if issues:
            lines.append("- **Issues:**")
            for it in issues:
                lines.append(f"  - {it}")
        lines.append("")

    incidents = state.get("incidents") or []
    lines.append(f"**{len(incidents)} incidents** classified.\n")

    # Per-incident sections.
    for inc in incidents:
        fix = (state.get("remediations") or {}).get(inc.id)
        lines.append(f"## {inc.id} — {inc.error_type} on `{inc.service}` ({inc.severity})")
        lines.append(f"{inc.summary}\n")
        if fix:
            lines.append(f"**Fix rationale:** {fix.rationale}\n")
            lines.append("**Steps:**")
            for n, s in enumerate(fix.steps, 1):
                lines.append(f"{n}. {s}")
            lines.append("")

    # Append the consolidated cookbook checklist.
    if cb := state.get("cookbook"):
        lines.append(f"\n# {cb.title}")
        for it in cb.items:
            lines.append(f"- [ ] {it}")

    # Footer with execution path + notifications.
    if path := state.get("execution_path"):
        lines.append(f"\n_Execution path: {' → '.join(path)}_")
    if state.get("slack_thread_ts"):
        lines.append(f"_Slack thread: `{state['slack_thread_ts']}`_")
    if keys := state.get("jira_keys"):
        lines.append(f"_JIRA tickets: {', '.join(keys)}_")

    trace = list(state.get("execution_path") or [])
    trace.append("report")
    return {"report_md": "\n".join(lines), "execution_path": trace}


def build_graph():
    """Construct and compile the LangGraph DAG with conditional routing.

    The compiled graph is a Runnable — call .invoke({"raw_logs": "..."})
    on it and it walks every node, taking the right branch at each
    conditional edge based on state.
    """
    g = StateGraph(State)

    # --- Register every node ------------------------------------------------
    g.add_node("classify", classify_traced)
    g.add_node("severity_router", severity_router_node)
    g.add_node("deep_analysis", deep_analysis)
    g.add_node("rag_retriever", rag_retriever)
    g.add_node("summary_report", summary_report)
    g.add_node("remediate", remediate_traced)
    g.add_node("validator", validate_remediation)
    g.add_node("cookbook", synthesize_traced)
    g.add_node("human_approval", human_approval)
    g.add_node("slack", notify_slack_traced)
    g.add_node("jira", file_jira_traced)
    g.add_node("report", build_report)

    # --- Linear setup edges -------------------------------------------------
    g.add_edge(START, "classify")
    g.add_edge("classify", "severity_router")

    # --- Conditional split after severity router ---------------------------
    # Critical/high get deep analysis + RAG; medium gets RAG; low goes
    # straight to remediation; info bypasses remediation entirely.
    g.add_conditional_edges(
        "severity_router",
        route_by_severity,
        {
            "deep_analysis": "deep_analysis",
            "rag_retriever": "rag_retriever",
            "remediate": "remediate",
            "summary_report": "summary_report",
        },
    )
    # deep_analysis always feeds into RAG (critical/high)
    g.add_edge("deep_analysis", "rag_retriever")
    g.add_edge("rag_retriever", "remediate")

    # --- Validator + retry loop --------------------------------------------
    g.add_edge("remediate", "validator")
    g.add_conditional_edges(
        "validator",
        route_after_validation,
        {
            "remediate": "remediate",        # retry loop (max 2 enforced inside validator)
            "cookbook": "cookbook",
            "human_approval": "human_approval",
        },
    )

    # --- Happy path after cookbook -----------------------------------------
    g.add_edge("cookbook", "human_approval")
    g.add_edge("human_approval", "slack")
    g.add_edge("slack", "jira")
    g.add_edge("jira", "report")

    # Info-only path skips straight to report.
    g.add_edge("summary_report", "report")

    g.add_edge("report", END)

    return g.compile()
