"""Scenario-level eval runner for the hackathon demo.

These evals execute the existing LangGraph workflow directly against sample
logs and compare the resulting state with expected scenario outcomes. They
are intentionally lightweight: no FastAPI server, React frontend, Gmail,
Slack/JIRA credentials, or LangSmith key is required.
"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
CASES_PATH = ROOT / "evals" / "eval_cases.json"
RESULTS_PATH = ROOT / "evals" / "eval_results.md"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@dataclass
class EvalResult:
    case_id: str
    expected: dict[str, Any]
    actual: dict[str, Any]
    failures: list[str]

    @property
    def passed(self) -> bool:
        return not self.failures


def _load_cases() -> list[dict[str, Any]]:
    return json.loads(CASES_PATH.read_text(encoding="utf-8"))


def _read_logs(case: dict[str, Any]) -> str:
    if "inline_log" in case:
        return str(case["inline_log"])

    input_file = case.get("input_file")
    if not input_file:
        raise ValueError(f"{case.get('case_id', '<unknown>')} has no input_file or inline_log")

    return (ROOT / input_file).read_text(encoding="utf-8")


def _is_report_present(state: dict[str, Any]) -> bool:
    return bool(
        state.get("final_report")
        or state.get("report")
        or state.get("report_md")
    )


def _actual_from_state(state: dict[str, Any]) -> dict[str, Any]:
    rag_sources = state.get("rag_sources") or []
    rag_confidence = state.get("rag_confidence") or "none"

    return {
        "severity": state.get("severity"),
        "routing_path": state.get("routing_path"),
        "rag_sources": rag_sources,
        "rag_confidence": rag_confidence,
        "rag_used": bool(rag_sources) or rag_confidence not in ("", "none", None),
        "validator_status": state.get("validator_status"),
        "report_present": _is_report_present(state),
        "execution_path": state.get("execution_path") or [],
    }


def _validate_case(case: dict[str, Any], actual: dict[str, Any]) -> EvalResult:
    expected = case.get("expected", {})
    failures: list[str] = []

    expected_severity = expected.get("severity")
    expected_severities = expected.get("severity_any_of")
    if expected_severities:
        if actual["severity"] not in expected_severities:
            failures.append(
                f"severity expected one of {expected_severities} but got {actual['severity']}"
            )
    elif expected_severity and actual["severity"] != expected_severity:
        failures.append(
            f"severity expected {expected_severity} but got {actual['severity']}"
        )

    routing_contains = expected.get("routing_path_contains")
    actual_routing = str(actual.get("routing_path") or "")
    if routing_contains and routing_contains.lower() not in actual_routing.lower():
        failures.append(
            f"routing path expected to contain {routing_contains!r} but got {actual_routing!r}"
        )

    if "rag_expected" in expected:
        rag_expected = bool(expected["rag_expected"])
        if rag_expected and not actual["rag_used"]:
            failures.append(
                f"RAG expected but got sources={actual['rag_sources']} "
                f"confidence={actual['rag_confidence']}"
            )
        if not rag_expected and actual["rag_used"]:
            failures.append(
                f"RAG not expected but got sources={actual['rag_sources']} "
                f"confidence={actual['rag_confidence']}"
            )

    expected_confidence = expected.get("rag_confidence")
    if expected_confidence and actual["rag_confidence"] != expected_confidence:
        failures.append(
            f"rag_confidence expected {expected_confidence} but got {actual['rag_confidence']}"
        )

    source_keywords = expected.get("rag_source_contains_any") or []
    if source_keywords:
        sources = [str(source).lower() for source in actual["rag_sources"]]
        if not any(keyword.lower() in source for keyword in source_keywords for source in sources):
            failures.append(
                f"expected RAG source containing one of {source_keywords} "
                f"but got {actual['rag_sources']}"
            )

    expected_validator = expected.get("validator_status")
    if expected_validator and actual["validator_status"] != expected_validator:
        failures.append(
            f"validator_status expected {expected_validator} but got {actual['validator_status']}"
        )

    if expected.get("report_present") is True and not actual["report_present"]:
        failures.append("report expected to be present but was missing")

    return EvalResult(
        case_id=str(case["case_id"]),
        expected=expected,
        actual=actual,
        failures=failures,
    )


def _format_bool(value: Any) -> str:
    return "yes" if bool(value) else "no"


def _write_markdown(results: list[EvalResult]) -> None:
    lines = [
        "# Evaluation Results",
        "",
        "These evals validate scenario-level behavior using sample logs. They complement unit tests by checking severity routing, RAG behavior, validator output, and report generation across realistic incident inputs.",
        "",
        f"Last run: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        "",
        "| Case ID | Expected Severity | Actual Severity | Expected Routing | Actual Routing | RAG Expected | Actual RAG | Validator Expected | Actual Validator | Report Present | Status |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]

    for result in results:
        expected = result.expected
        actual = result.actual
        status = "PASS" if result.passed else "FAIL"
        rag_expected = expected.get("rag_expected", "")
        actual_rag = (
            f"{_format_bool(actual['rag_used'])}; "
            f"{actual['rag_confidence']}; "
            f"{', '.join(actual['rag_sources']) or 'no sources'}"
        )
        lines.append(
            "| {case_id} | {expected_severity} | {actual_severity} | {expected_routing} | "
            "{actual_routing} | {rag_expected} | {actual_rag} | {expected_validator} | "
            "{actual_validator} | {report_present} | {status} |".format(
                case_id=result.case_id,
                expected_severity=", ".join(expected.get("severity_any_of", []))
                or expected.get("severity", ""),
                actual_severity=actual.get("severity") or "",
                expected_routing=expected.get("routing_path_contains", ""),
                actual_routing=actual.get("routing_path") or "",
                rag_expected=rag_expected,
                actual_rag=actual_rag,
                expected_validator=expected.get("validator_status", "not applicable"),
                actual_validator=actual.get("validator_status") or "not applicable",
                report_present=_format_bool(actual.get("report_present")),
                status=status,
            )
        )

    RESULTS_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_evals() -> int:
    load_dotenv(ROOT / ".env")

    if not os.getenv("OPENROUTER_API_KEY"):
        print("OPENROUTER_API_KEY is required to run scenario evals.")
        return 2

    from agents.graph import build_graph

    print("Running scenario evals...\n")
    graph = build_graph()
    results: list[EvalResult] = []

    for case in _load_cases():
        case_id = case["case_id"]
        logs = _read_logs(case)
        try:
            state = graph.invoke({"raw_logs": logs})
            actual = _actual_from_state(state)
            result = _validate_case(case, actual)
        except Exception as exc:
            result = EvalResult(
                case_id=case_id,
                expected=case.get("expected", {}),
                actual={},
                failures=[f"execution failed: {type(exc).__name__}: {exc}"],
            )

        results.append(result)
        print(f"{case_id}: {'PASS' if result.passed else 'FAIL'}")
        for failure in result.failures:
            print(f"  - {failure}")

    passed = sum(1 for result in results if result.passed)
    total = len(results)
    _write_markdown(results)

    print(f"\n{passed}/{total} eval cases passed.")
    print("Results written to evals/eval_results.md")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(run_evals())
