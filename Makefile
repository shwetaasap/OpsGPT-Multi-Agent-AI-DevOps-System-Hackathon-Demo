# Convenience targets for the C6 Hackathon multi-agent DevOps suite.
# All targets assume you have an active Python 3.10+ venv and Node 20+ installed.

.PHONY: setup test eval run frontend smoke build-frontend clean help

help:
	@echo "Available targets:"
	@echo "  make setup           Install Python + frontend dependencies"
	@echo "  make test            Run pytest (22 unit tests)"
	@echo "  make eval            Run scenario evals against Sample_logs/"
	@echo "  make smoke           Quick graph-builds-cleanly check"
	@echo "  make run             Start FastAPI backend at :8000"
	@echo "  make frontend        Start React dev server (separate terminal)"
	@echo "  make build-frontend  Production build of the React UI"
	@echo "  make clean           Remove __pycache__/.pytest_cache/dist"

setup:
	pip install -r requirements.txt
	cd web && npm install

test:
	pytest -q

eval:
	python evals/run_evals.py

smoke:
	python -c "from agents.graph import build_graph; g=build_graph(); print('graph OK,', len(g.get_graph().nodes), 'nodes')"

run:
	uvicorn app.server:app --reload --port 8000

frontend:
	cd web && npm run dev

build-frontend:
	cd web && npm run build

clean:
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf .pytest_cache web/dist
