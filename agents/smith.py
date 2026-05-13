"""Optional LangSmith tracing helpers.

The main LangChain/LangGraph stack picks up LangSmith tracing from
environment variables. We mirror values to BOTH the new `LANGSMITH_*`
names and the legacy `LANGCHAIN_*` names so tracing works regardless of
the installed langchain version.
"""
from __future__ import annotations

import os


def configure_langsmith() -> bool:
    """Return True when LangSmith tracing is explicitly enabled."""
    tracing = os.getenv("LANGSMITH_TRACING", os.getenv("LANGCHAIN_TRACING_V2", "false")).strip().lower()
    if tracing not in ("1", "true", "yes", "on"):
        return False

    api_key = os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY")
    if not api_key:
        return False

    endpoint = os.getenv("LANGSMITH_ENDPOINT") or os.getenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")
    project = os.getenv("LANGSMITH_PROJECT") or os.getenv("LANGCHAIN_PROJECT", "C6-Hackathon-Group-4")

    # Set every alias so older langchain releases also pick it up.
    for k, v in {
        "LANGSMITH_TRACING": "true",
        "LANGCHAIN_TRACING_V2": "true",
        "LANGSMITH_API_KEY": api_key,
        "LANGCHAIN_API_KEY": api_key,
        "LANGSMITH_ENDPOINT": endpoint,
        "LANGCHAIN_ENDPOINT": endpoint,
        "LANGSMITH_PROJECT": project,
        "LANGCHAIN_PROJECT": project,
    }.items():
        os.environ[k] = v

    return True


def get_traced_openai_client():
    """Build a LangSmith-wrapped OpenAI client when all credentials exist.

    Returns None when tracing or OpenRouter credentials are absent.
    """
    if not configure_langsmith():
        return None

    base_url = os.getenv("OPENROUTER_BASE_URL")
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not base_url or not api_key:
        return None

    from openai import OpenAI
    from langsmith import wrappers

    return wrappers.wrap_openai(OpenAI(base_url=base_url, api_key=api_key))
