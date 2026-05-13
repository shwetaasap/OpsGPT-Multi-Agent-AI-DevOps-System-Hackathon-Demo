"""Token + cost tracker for a single /api/analyze run.

Attaches as a LangChain callback so every ChatOpenAI/`with_structured_output`
call inside the LangGraph pipeline contributes to one running total. The
totals are returned by the API and surfaced in the OpsGPT UI alongside the
incident output.

Pricing is in USD per **million** tokens, taken from OpenRouter's published
rates (https://openrouter.ai/models). The OpenRouter `provider/` prefix is
preserved so we look up the exact id we send to ChatOpenAI.
"""
from __future__ import annotations

import os
import re
from typing import Any

from langchain_core.callbacks import BaseCallbackHandler

PRICING: dict[str, dict[str, float]] = {
    # Canonical OpenRouter ids.
    "anthropic/claude-sonnet-4.5":   {"input": 3.00, "output": 15.00},
    "anthropic/claude-haiku-4.5":    {"input": 0.80, "output": 4.00},
    "anthropic/claude-opus-4.5":     {"input": 15.00, "output": 75.00},
    # Aliases — OpenRouter's response sometimes reorders the model id.
    "anthropic/claude-4.5-sonnet":   {"input": 3.00, "output": 15.00},
    "anthropic/claude-4.5-haiku":    {"input": 0.80, "output": 4.00},
    "anthropic/claude-4.5-opus":     {"input": 15.00, "output": 75.00},
    "openai/gpt-4o":                 {"input": 2.50, "output": 10.00},
    "openai/gpt-4o-mini":            {"input": 0.15, "output": 0.60},
    "openai/gpt-4.1":                {"input": 2.00, "output": 8.00},
    "openai/gpt-4.1-mini":           {"input": 0.40, "output": 1.60},
    "google/gemini-2.5-pro":         {"input": 1.25, "output": 5.00},
    "google/gemini-2.5-flash":       {"input": 0.075, "output": 0.30},
    "meta-llama/llama-3.3-70b-instruct": {"input": 0.13, "output": 0.40},
}

# OpenRouter sometimes returns dated variants (e.g.
# "anthropic/claude-4.5-sonnet-20250929") that don't match the pricing
# keys above. Strip the date suffix and let our resolver fall back to
# OPENROUTER_MODEL when the bare id still doesn't match.
_DATE_SUFFIX_RE = re.compile(r"-\d{8}$")


def _resolve_pricing(model: str | None) -> dict[str, float] | None:
    if model:
        if model in PRICING:
            return PRICING[model]
        bare = _DATE_SUFFIX_RE.sub("", model)
        if bare in PRICING:
            return PRICING[bare]
    # Fall back to whatever the user asked for via env.
    requested = os.getenv("OPENROUTER_MODEL")
    if requested and requested in PRICING:
        return PRICING[requested]
    return None


def _extract_usage(response: Any) -> tuple[int, int, str | None]:
    """Pull (prompt_tokens, completion_tokens, model_name) from an LLMResult."""
    llm_output = getattr(response, "llm_output", None) or {}
    model = llm_output.get("model_name") or llm_output.get("model")
    usage = llm_output.get("token_usage") or {}
    prompt = int(usage.get("prompt_tokens") or 0)
    completion = int(usage.get("completion_tokens") or 0)

    # Some langchain-openai versions put usage on the message instead.
    if not prompt and not completion:
        for gen_list in getattr(response, "generations", []) or []:
            for gen in gen_list or []:
                msg = getattr(gen, "message", None)
                meta = getattr(msg, "usage_metadata", None) or {}
                prompt = prompt or int(meta.get("input_tokens") or 0)
                completion = completion or int(meta.get("output_tokens") or 0)
                if prompt or completion:
                    break

    return prompt, completion, model


class CostTracker(BaseCallbackHandler):
    """Sums token usage and computes USD cost across all LLM calls in a run."""

    def __init__(self) -> None:
        self.input_tokens: int = 0
        self.output_tokens: int = 0
        self.cost_usd: float = 0.0
        self.calls: int = 0
        self.unpriced_calls: int = 0  # Calls where we couldn't find pricing.
        self.models_seen: set[str] = set()

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    def on_llm_end(self, response: Any, **kwargs: Any) -> None:
        prompt, completion, model = _extract_usage(response)
        if not prompt and not completion:
            return  # nothing to count

        self.input_tokens += prompt
        self.output_tokens += completion
        self.calls += 1
        if model:
            self.models_seen.add(model)

        rate = _resolve_pricing(model)
        if rate is None:
            self.unpriced_calls += 1
            return
        self.cost_usd += (prompt * rate["input"] + completion * rate["output"]) / 1_000_000

    def summary(self) -> dict[str, Any]:
        return {
            "llm_calls": self.calls,
            "total_tokens_input": self.input_tokens,
            "total_tokens_output": self.output_tokens,
            "total_tokens": self.total_tokens,
            "total_cost_usd": round(self.cost_usd, 6),
            "models_used": sorted(self.models_seen),
            "unpriced_calls": self.unpriced_calls,
        }
