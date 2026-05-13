"""Cookbook synthesizer agent.

Takes ALL incidents + their remediations and produces ONE consolidated
checklist ordered by impact. Useful as a single artifact a team can copy
into a postmortem doc or a Jira epic description.

Single LLM call (cheap), runs after all per-incident fixes are ready.
"""
from .config import get_llm
from .models import Checklist, State

PROMPT = """Build ONE consolidated checklist that covers all the incidents below.

Style rules:
- Plain English. No jargon, no command-line syntax, no Kubernetes-specific terms.
- Each item is a short sentence (under 15 words) describing what to do.
- Group related steps together implicitly via ordering.
- Order by impact: most critical fix first, prevention/follow-up last.
- 8 to 14 items total.

INCIDENTS:
{incidents}

REMEDIATIONS:
{remediations}
"""


def synthesize(state: State) -> dict:
    """LangGraph node: produce a single Checklist from all incidents+fixes."""
    llm = get_llm(max_tokens=2048, structured_output_schema=Checklist)

    # Compact one-line-per-incident summaries — keeps the prompt tight.
    incidents_str = "\n".join(
        f"- {i.id} [{i.severity}] {i.service}: {i.summary}" for i in state["incidents"]
    )
    rem_str = "\n".join(
        f"- {fix.incident_id}: {fix.rationale}" for fix in state["remediations"].values()
    )

    cookbook = llm.invoke(PROMPT.format(incidents=incidents_str, remediations=rem_str))
    return {"cookbook": cookbook}
