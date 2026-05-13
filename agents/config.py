"""Centralized LLM factory.

Every agent calls get_llm() instead of building its own ChatOpenAI client.
This way we configure the model + API key in ONE place. Swap providers or
models by editing .env, no code changes needed.

We use langchain-openai (the OpenAI SDK wrapper) but point it at OpenRouter,
which exposes an OpenAI-compatible endpoint. OpenRouter lets us switch
between Claude, GPT, Gemini, Llama, etc. with just a model-name change.

Configuration is read at *call time* (not import time) so per-request
overrides — e.g. an `X-OpenRouter-API-Key` header from the UI — can swap
the env var for the duration of one request via app/server.py.
"""
import os
from dotenv import load_dotenv          # reads .env file into os.environ
from langchain_openai import ChatOpenAI  # LangChain's OpenAI-compatible chat model

# Load .env once at import time so os.getenv works for the rest of the file.
load_dotenv()


def _settings() -> tuple[str, str, str]:
    """Read model / base URL / API key from env at call time.

    Returns (model, base_url, api_key). Each is read fresh so server.py can
    override OPENROUTER_API_KEY (or OPENROUTER_MODEL) per-request.
    """
    return (
        os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.5"),
        os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        os.getenv("OPENROUTER_API_KEY", ""),
    )


def get_llm(max_tokens: int = 2048, structured_output_schema=None):
    """Build a Chat LLM bound to OpenRouter.

    Args:
        max_tokens: maximum response length. Bigger = pricier + slower.
        structured_output_schema: a Pydantic model class. When provided, the
            LLM is forced to return data matching that schema (instead of
            free-form text). This is the magic that makes our agents reliable.

    Returns:
        A LangChain Runnable. Call .invoke(prompt_string) on it.
    """
    model, base_url, api_key = _settings()

    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. Set it in the Settings tab of the "
            "UI, or copy .env.example to .env and fill it in."
        )

    # OpenRouter prefixes model ids with "<provider>/" (e.g. "anthropic/...").
    # LangSmith's pricing catalog matches on the bare model name, so we
    # split and surface both as metadata — that lights up cost on every span.
    if "/" in model:
        ls_provider, raw_model_name = model.split("/", 1)
    else:
        ls_provider, raw_model_name = "openai", model
    # LangSmith's pricing catalog keys Anthropic models as `claude-sonnet-4-5`
    # (dashes), but OpenRouter exposes the same model as `claude-sonnet-4.5`
    # (dot). Normalize to the catalog format so cost lights up on every span.
    ls_model_name = raw_model_name.replace(".", "-")

    llm = ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url=base_url,
        max_tokens=max_tokens,
        # Headers OpenRouter uses to attribute usage on their dashboard.
        # Must be ASCII only — non-ASCII characters (em-dash etc.) will crash.
        default_headers={
            "HTTP-Referer": "https://github.com/C6-Hackathon-Group-4",
            "X-Title": "C6 Hackathon - DevOps Incident Suite",
        },
        metadata={
            "ls_provider": ls_provider,
            "ls_model_name": ls_model_name,
            "ls_model_type": "chat",
        },
    )
    if structured_output_schema is not None:
        return llm.with_structured_output(structured_output_schema)
    return llm
