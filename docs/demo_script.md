# Demo Script

Recorded walkthrough: https://youtu.be/j4xBnNJL48Q

## 1. Project Intro

OpsGPT is a Multi-Agent DevOps Incident Analysis Suite built for the Outskill AI Engineering Hackathon. It turns raw operational logs into structured incidents, RAG-grounded remediation steps, validator feedback, mock notification/ticket outputs, and a final incident report. If the live app is unavailable during judging, use the recorded walkthrough as the end-to-end reference demo.

## 2. Architecture Overview

The frontend is React + Vite. The backend is FastAPI. The incident pipeline is orchestrated with LangGraph and includes a classifier, severity router, RAG retriever over markdown runbooks, remediation agent, validator/critic loop, cookbook generator, human approval gate, demo-safe Slack/JIRA mock tools, and final report builder.

## 3. Main Demo Case

Use `Sample_logs/payment_errors.log`.

Start the backend and frontend:

```bash
uvicorn app.server:app --reload --port 8000
cd web
npm run dev
```

In the UI, upload or paste `payment_errors.log`. This case is the strongest demo because it triggers the critical/high path and shows RAG, validation, and mock notification/ticket outputs.

The same path is captured in the demo video, so judges can still review the full workflow asynchronously.

## 4. Severity Router

Show that payment gateway errors are routed as critical/high. Explain that the severity router determines whether the graph uses deep analysis, RAG, remediation, validation, human approval, and notification/ticket actions.

## 5. RAG Runbook Retrieval

Point out the retrieved runbooks, RAG sources, and RAG confidence. The remediation is grounded in the markdown runbooks under `knowledge_base/`, using BM25 retrieval.

## 6. Validator / Critic Loop

Show the validator status and quality score. Explain that weak remediation can loop back for up to two retries, while approved remediation continues to cookbook generation and reporting.

## 7. Mock Slack/JIRA Outputs

Show the Slack and JIRA sections. Clarify that they are demo-safe mock tools: no external credentials are required, but the output demonstrates the tool/action integration pattern.

## 8. Tests and Evals

Show the validation commands:

```bash
pytest -q
python evals/run_evals.py
```

Explain that unit tests cover router, validator, and notifier logic, while evals validate full scenario behavior across realistic sample logs.

## 9. Closing

OpsGPT demonstrates a practical multi-agent incident workflow: logs in, severity routing, RAG evidence, remediation, validation, mock action outputs, and a final report ready for an SRE handoff.
