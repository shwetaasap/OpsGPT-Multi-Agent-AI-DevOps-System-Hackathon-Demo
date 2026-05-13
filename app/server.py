"""FastAPI HTTP server exposing the LangGraph pipeline + serving the React UI.

Run locally:
    uvicorn app.server:app --reload --port 8000

In production (containerized) the same image serves /api/* and the built
React static bundle from /app/web/dist.

Per-request OpenRouter override:
    The /api/analyze endpoint accepts an optional `X-OpenRouter-API-Key`
    header. When set, the env var is swapped for the duration of that
    request so each user can BYO-key from the Settings UI without losing
    the Vault-backed default.
"""
import os
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterator, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agents.cost import CostTracker
from agents.graph import build_graph
from agents.smith import configure_langsmith

load_dotenv()

# Initialize LangSmith tracing at import time (no-op unless LANGSMITH_TRACING=true
# AND LANGSMITH_API_KEY is set in the environment). When enabled, every LangChain
# / LangGraph call inside this app — classifier, remediation, cookbook — appears
# as a span in the LangSmith project dashboard.
configure_langsmith()

app = FastAPI(title="DevOps Incident Analysis API")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graph = build_graph()


class AnalyzeRequest(BaseModel):
    logs: str


# Serialize per-request env-var swaps so concurrent /analyze calls with
# different API keys don't clobber each other. The pipeline is LLM-bound so
# real concurrency is low — this is a pragmatic mutex, not a hot path.
_env_lock = threading.Lock()


@contextmanager
def _env_override(updates: Dict[str, Optional[str]]) -> Iterator[None]:
    """Temporarily set env vars for the duration of a block, then restore."""
    saved: Dict[str, Optional[str]] = {}
    with _env_lock:
        try:
            for key, value in updates.items():
                saved[key] = os.environ.get(key)
                if value is None:
                    continue
                os.environ[key] = value
            yield
        finally:
            for key, prior in saved.items():
                if prior is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = prior


@app.get("/healthz", include_in_schema=False)
def healthz() -> dict[str, str]:
    """Kubernetes liveness/readiness probe target."""
    return {"status": "ok"}


@app.get("/api/health")
def health() -> dict[str, bool]:
    """Includes whether a server-side OpenRouter key is configured."""
    return {
        "status": True,
        "server_key_configured": bool(os.getenv("OPENROUTER_API_KEY")),
    }


@app.post("/api/analyze")
def analyze(
    req: AnalyzeRequest,
    x_openrouter_api_key: Optional[str] = Header(default=None, alias="X-OpenRouter-API-Key"),
    x_openrouter_model: Optional[str] = Header(default=None, alias="X-OpenRouter-Model"),
) -> dict[str, Any]:
    if not req.logs.strip():
        raise HTTPException(status_code=400, detail="logs is empty")

    overrides: Dict[str, Optional[str]] = {}
    if x_openrouter_api_key:
        overrides["OPENROUTER_API_KEY"] = x_openrouter_api_key
    if x_openrouter_model:
        overrides["OPENROUTER_MODEL"] = x_openrouter_model

    tracker = CostTracker()
    invoke_config = {"callbacks": [tracker]}
    try:
        if overrides:
            with _env_override(overrides):
                state = graph.invoke({"raw_logs": req.logs}, config=invoke_config)
        else:
            state = graph.invoke({"raw_logs": req.logs}, config=invoke_config)
    except RuntimeError as e:
        # agents/config.py raises this when no API key is available.
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"pipeline failure: {e}")

    incidents = [i.model_dump() for i in state.get("incidents", [])]
    remediations = {k: v.model_dump() for k, v in state.get("remediations", {}).items()}
    cookbook = state["cookbook"].model_dump() if state.get("cookbook") else None

    return {
        # Core analysis output
        "incidents": incidents,
        "remediations": remediations,
        "cookbook": cookbook,
        "report_md": state.get("report_md", ""),

        # RAG payload
        "rag_sources": state.get("rag_sources", []),
        "rag_confidence": state.get("rag_confidence", "none"),
        "rag_compliance": state.get("rag_compliance", []),
        "rag_snippet_count": state.get("rag_snippet_count", 0),

        # Severity router output (run-level)
        "severity": state.get("severity"),
        "incident_type": state.get("incident_type"),
        "routing_path": state.get("routing_path"),
        "routing_reason": state.get("routing_reason"),
        "flags": {
            "requires_deep_analysis": state.get("requires_deep_analysis", False),
            "requires_rag": state.get("requires_rag", False),
            "requires_human_approval": state.get("requires_human_approval", False),
            "requires_ticket": state.get("requires_ticket", False),
            "requires_notification": state.get("requires_notification", False),
        },

        # Validator output
        "validator_status": state.get("validator_status"),
        "quality_score": state.get("quality_score"),
        "issues_found": state.get("issues_found", []),
        "revision_instruction": state.get("revision_instruction", ""),
        "escalation_required": state.get("escalation_required", False),
        "validation_reason": state.get("validation_reason"),
        "retry_count": state.get("retry_count", 0),

        # Human approval + execution trace
        "human_approval_status": state.get("human_approval_status"),
        "execution_path": state.get("execution_path", []),

        # Demo-safe notifier mock outputs
        "slack_status": state.get("slack_status", "skipped"),
        "slack_channel": state.get("slack_channel"),
        "slack_message_id": state.get("slack_message_id"),
        "slack_thread_ts": state.get("slack_thread_ts"),
        "slack_message_preview": state.get("slack_message_preview", ""),
        "jira_status": state.get("jira_status", "skipped"),
        "jira_keys": state.get("jira_keys", []),
        "jira_priority": state.get("jira_priority"),
        "jira_summary": state.get("jira_summary", ""),
        "jira_description_preview": state.get("jira_description_preview", ""),

        # Token + USD cost summary for this run (computed by CostTracker
        # callback during graph.invoke). Surfaces in the OpsGPT UI's
        # "Latest Run" card and the Workflow header.
        "usage": tracker.summary(),
    }


# --- Serve the built React frontend (production) ----------------------------
WEB_DIST = Path(__file__).parent.parent / "web" / "dist"

if WEB_DIST.is_dir():
    assets_dir = WEB_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> FileResponse:
        if path.startswith("api/") or path == "healthz":
            raise HTTPException(status_code=404)
        candidate = WEB_DIST / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(WEB_DIST / "index.html")
