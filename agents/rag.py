"""RAG over the knowledge_base/ runbooks.

Why BM25 instead of embeddings:
  - Zero API calls, no extra credentials, works offline.
  - No torch / sentence-transformers dependency (~2 GB install).
  - For a curated KB of ~10 documents, BM25 is competitive with semantic search.

Drop-in upgrade path: replace _build_index() with any LangChain VectorStore
(Chroma, FAISS, InMemoryVectorStore) and update retrieve_detailed().

Public API:
  retrieve_detailed(query, k) -> list[RetrievedSnippet]
      Returns dicts with source / matched_section / content / score.
  build_rag_payload(query, k) -> dict
      Returns the full structured payload that gets stored in graph state:
      {retrieved_runbooks, rag_context, rag_sources, rag_confidence}.
  retrieve(query, k) -> list[str]
      Backward-compatible plain-text helper.
  kb_size() -> int
"""
import re
from pathlib import Path
from typing import TypedDict
from rank_bm25 import BM25Okapi


# Knowledge base lives at the repo root.
KB_DIR = Path(__file__).resolve().parent.parent / "knowledge_base"


class RetrievedSnippet(TypedDict):
    """One match returned from the knowledge base."""
    source: str           # filename without extension, e.g. "nginx_502_runbook"
    matched_section: str  # the ## header that introduces this chunk
    content: str          # the snippet body (without the [from xxx] prefix)
    score: float          # BM25 relevance score (higher = better)


def _tokenize(text: str) -> list[str]:
    """Lower-case word tokenization."""
    return re.findall(r"[a-z0-9]+", text.lower())


def _extract_section_header(chunk_text: str) -> str:
    """Pull the first ## header from a chunk, or fall back to the # title."""
    for line in chunk_text.splitlines():
        line = line.strip()
        if line.startswith("## "):
            return line.removeprefix("## ").strip()
        if line.startswith("# "):
            return line.removeprefix("# ").strip()
    return "(unknown section)"


def _chunk_markdown(text: str, source: str) -> list[dict]:
    """Split a markdown doc into chunks keyed by ## headers.

    Each chunk records its source filename + the section header so we can
    surface them in the structured retrieval result.
    """
    chunks: list[dict] = []
    sections = re.split(r"\n(?=## )", text)
    for sec in sections:
        sec = sec.strip()
        if not sec or len(sec) < 50:
            continue
        chunks.append({
            "source": source,
            "matched_section": _extract_section_header(sec),
            "content": sec,
        })
    return chunks


def _build_index() -> tuple[BM25Okapi, list[dict]]:
    """Load all runbooks, chunk them, build the BM25 index ONCE at startup."""
    chunks: list[dict] = []
    if KB_DIR.exists():
        for md_file in sorted(KB_DIR.glob("*.md")):
            text = md_file.read_text(encoding="utf-8")
            chunks.extend(_chunk_markdown(text, md_file.stem))

    if not chunks:
        return BM25Okapi([["placeholder"]]), []

    tokenized_corpus = [_tokenize(c["content"]) for c in chunks]
    return BM25Okapi(tokenized_corpus), chunks


_INDEX, _CHUNKS = _build_index()


def _confidence_label(top_score: float) -> str:
    """Map a BM25 score to a coarse confidence band for UI display.

    BM25 scores are unbounded but typically fall in 0-15 range for our corpus.
    Thresholds tuned empirically from the bundled runbooks; tweak as needed.
    """
    if top_score >= 5.0:
        return "high"
    if top_score >= 2.0:
        return "medium"
    if top_score > 0.0:
        return "low"
    return "none"


def retrieve_detailed(query: str, k: int = 3) -> list[RetrievedSnippet]:
    """Return top-k matching snippets as structured dicts.

    Returns:
        List of RetrievedSnippet dicts, sorted by score descending. Empty list
        if no matches. Filters out zero-score results (no keyword overlap).
    """
    if not _CHUNKS:
        return []

    tokenized_query = _tokenize(query)
    if not tokenized_query:
        return []

    scores = _INDEX.get_scores(tokenized_query)
    ranked = sorted(zip(scores, _CHUNKS), key=lambda x: x[0], reverse=True)

    return [
        RetrievedSnippet(
            source=f"{chunk['source']}.md",
            matched_section=chunk["matched_section"],
            content=chunk["content"],
            score=round(float(score), 3),
        )
        for score, chunk in ranked[:k]
        if score > 0
    ]


def build_rag_payload(query: str, k: int = 3) -> dict:
    """Build the full RAG payload for storing in graph state.

    Returns a dict shaped like:
        {
          "retrieved_runbooks": [{source, matched_section, content, score}, ...],
          "rag_context": "concatenated snippet text used in prompts",
          "rag_sources": ["nginx_502_runbook.md", ...],   # unique
          "rag_confidence": "high" | "medium" | "low" | "none"
        }
    """
    snippets = retrieve_detailed(query, k=k)

    rag_context = (
        "\n\n---\n\n".join(
            f"[from {s['source']} -> {s['matched_section']}]\n{s['content']}"
            for s in snippets
        )
        if snippets
        else "(no specific runbook matched)"
    )

    # Dedupe sources while preserving rank order.
    seen: set[str] = set()
    unique_sources: list[str] = []
    for s in snippets:
        if s["source"] not in seen:
            seen.add(s["source"])
            unique_sources.append(s["source"])

    confidence = _confidence_label(snippets[0]["score"] if snippets else 0.0)

    return {
        "retrieved_runbooks": snippets,
        "rag_context": rag_context,
        "rag_sources": unique_sources,
        "rag_confidence": confidence,
    }


def retrieve(query: str, k: int = 3) -> list[str]:
    """Backward-compatible plain-text retrieval.

    Returns a list of pre-formatted snippet strings ready to drop into a prompt.
    """
    detailed = retrieve_detailed(query, k=k)
    return [
        f"[from {s['source']} -> {s['matched_section']}]\n{s['content']}"
        for s in detailed
    ]


def kb_size() -> int:
    """How many runbook chunks are currently indexed."""
    return len(_CHUNKS)
