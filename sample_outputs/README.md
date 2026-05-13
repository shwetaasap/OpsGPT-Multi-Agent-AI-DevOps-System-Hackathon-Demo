# Sample Outputs

End-to-end Markdown reports produced by running the full LangGraph pipeline
against the four log fixtures in `Sample_logs/`. Each file is the literal
`report_md` field returned by `build_graph().invoke({"raw_logs": ...})`.

| Sample log | Severity | Validator | Quality score | RAG confidence |
|---|---|---|---|---|
| [`payment_errors_report.md`](payment_errors_report.md) | critical | approved | 9/10 | high |
| [`disk_full_report.md`](disk_full_report.md) | critical | approved | 7/10 | high |
| [`website_slow_report.md`](website_slow_report.md) | high | approved | 8/10 | high |
| [`login_failures_report.md`](login_failures_report.md) | high | approved | 8/10 | high |

## Regenerating

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
python - <<'PY'
import sys; sys.path.insert(0, ".")
from pathlib import Path
from agents.graph import build_graph
graph = build_graph()
for log in Path("Sample_logs").glob("*.log"):
    state = graph.invoke({"raw_logs": log.read_text()})
    out = Path("sample_outputs") / f"{log.stem}_report.md"
    out.write_text(state.get("report_md", ""))
    print(f"{out} severity={state['severity']} validator={state['validator_status']}")
PY
```

The reports above were produced with `OPENROUTER_MODEL=openai/gpt-4o-mini`
to keep generation fast. With the default `anthropic/claude-sonnet-4.5`
the structure is identical and the prose is more polished.
