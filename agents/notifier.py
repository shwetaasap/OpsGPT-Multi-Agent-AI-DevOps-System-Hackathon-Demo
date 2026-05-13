"""Demo-safe Slack + JIRA notification tools.

These functions intentionally do not call external services. They return
realistic mock tool-action payloads so the demo can show notification and
ticketing behavior without credentials or network dependencies.
"""

from .models import State


def _primary_incident(state: State):
    incidents = state.get("incidents") or []
    return incidents[0] if incidents else None


def _mock_id(prefix: str, state: State) -> str:
    incident = _primary_incident(state)
    suffix = getattr(incident, "id", None) or "run"
    return f"{prefix}-{suffix.lower()}"


def _service(state: State) -> str:
    incident = _primary_incident(state)
    return getattr(incident, "service", None) or "unknown-service"


def _incident_type(state: State) -> str:
    incident = _primary_incident(state)
    return (
        getattr(incident, "error_type", None)
        or state.get("incident_type")
        or "incident"
    )


def notify_slack(state: State) -> dict:
    severity = (state.get("severity") or "info").lower()
    validator = state.get("validator_status") or "not_applicable"
    confidence = state.get("rag_confidence") or "none"

    if severity in ("critical", "high") and state.get("requires_notification"):
        message_id = _mock_id("mock-slack", state)
        return {
            "slack_status": "sent_mock",
            "slack_channel": "#sre-incidents",
            "slack_message_id": message_id,
            "slack_thread_ts": message_id,
            "slack_message_preview": (
                f"[{severity.upper()}] {_service(state)} incident detected. "
                f"Validator: {validator}. RAG confidence: {confidence}."
            ),
        }

    if severity == "medium":
        message_id = _mock_id("mock-slack", state)
        return {
            "slack_status": "prepared_mock",
            "slack_channel": "#sre-watch",
            "slack_message_id": message_id,
            "slack_thread_ts": message_id,
            "slack_message_preview": "[MEDIUM] Incident remediation prepared.",
        }

    return {
        "slack_status": "skipped",
        "slack_channel": None,
        "slack_message_id": None,
        "slack_thread_ts": None,
        "slack_message_preview": "",
    }


def file_jira(state: State) -> dict:
    severity = (state.get("severity") or "info").lower()

    if severity in ("critical", "high") and state.get("requires_ticket"):
        service = _service(state)
        incident_type = _incident_type(state)
        priority = "P1" if severity == "critical" else "P2"
        return {
            "jira_status": "created_mock",
            "jira_keys": ["OPS-1001"],
            "jira_priority": priority,
            "jira_summary": f"{severity.capitalize()} {service} incident - {incident_type}",
            "jira_description_preview": (
                f"Incident routed through {state.get('routing_path', 'unknown')}. "
                f"RAG sources: {', '.join(state.get('rag_sources') or []) or 'none'}. "
                f"Validator: {state.get('validator_status') or 'not_applicable'}."
            ),
        }

    return {
        "jira_status": "skipped",
        "jira_keys": [],
        "jira_priority": None,
        "jira_summary": "",
        "jira_description_preview": "",
    }
