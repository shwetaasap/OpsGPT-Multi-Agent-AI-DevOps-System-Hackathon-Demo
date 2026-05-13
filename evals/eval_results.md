# Evaluation Results

These evals validate scenario-level behavior using sample logs. They complement unit tests by checking severity routing, RAG behavior, validator output, and report generation across realistic incident inputs.

Last run: 2026-05-09 22:19:01 UTC

| Case ID | Expected Severity | Actual Severity | Expected Routing | Actual Routing | RAG Expected | Actual RAG | Validator Expected | Actual Validator | Report Present | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| payment_errors | critical | critical | critical | critical_deep_analysis_rag_validation_approval | True | yes; high; nginx_502_runbook.md, generic_incident_response.md, disk_space_runbook.md, memory_leak_runbook.md | approved | approved | yes | PASS |
| disk_full | critical | critical | critical | critical_deep_analysis_rag_validation_approval | True | yes; high; disk_space_runbook.md, database_connection_pool_runbook.md | approved | approved | yes | PASS |
| website_slow | high, critical | high | critical | critical_deep_analysis_rag_validation_approval | True | yes; high; database_connection_pool_runbook.md, generic_incident_response.md | approved | approved | yes | PASS |
| health_check | info | info | info_summary_only | info_summary_only | False | no; none; no sources | not applicable | not applicable | yes | PASS |
