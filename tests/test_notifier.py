"""Tests for demo-safe Slack/JIRA notifier mocks."""

from agents.models import Incident
from agents.notifier import file_jira, notify_slack


def _incident(severity: str = "critical") -> Incident:
    return Incident(
        id="INC-001",
        service="payments",
        error_type="Payment Gateway Timeout",
        severity=severity,
        summary="Payment gateway timeouts detected.",
        evidence="ERROR payments timeout",
    )


def test_critical_incident_returns_mock_slack_and_jira_actions():
    state = {
        "severity": "critical",
        "incidents": [_incident("critical")],
        "requires_notification": True,
        "requires_ticket": True,
        "validator_status": "approved",
        "rag_confidence": "high",
        "rag_sources": ["nginx_502_runbook.md", "generic_incident_response.md"],
        "routing_path": "critical_deep_analysis_rag_validation_approval",
    }

    slack = notify_slack(state)
    jira = file_jira({**state, **slack})

    assert slack["slack_status"] == "sent_mock"
    assert slack["slack_channel"] == "#sre-incidents"
    assert slack["slack_thread_ts"] == "mock-slack-inc-001"
    assert "[CRITICAL]" in slack["slack_message_preview"]

    assert jira["jira_status"] == "created_mock"
    assert jira["jira_keys"] == ["OPS-1001"]
    assert jira["jira_priority"] == "P1"
    assert "payments" in jira["jira_summary"]
    assert "nginx_502_runbook.md" in jira["jira_description_preview"]


def test_info_incident_skips_mock_notifications():
    state = {
        "severity": "info",
        "requires_notification": False,
        "requires_ticket": False,
        "incidents": [],
    }

    slack = notify_slack(state)
    jira = file_jira({**state, **slack})

    assert slack["slack_status"] == "skipped"
    assert slack["slack_thread_ts"] is None
    assert jira["jira_status"] == "skipped"
    assert jira["jira_keys"] == []
