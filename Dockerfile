# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22
ARG PYTHON_VERSION=3.12

# ---- Stage 1: build the React frontend ----
FROM node:${NODE_VERSION}-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---- Stage 2: install Python deps ----
FROM python:${PYTHON_VERSION}-slim AS deps
WORKDIR /app
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1
COPY requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---- Final image ----
FROM python:${PYTHON_VERSION}-slim
WORKDIR /app

# Bring installed Python packages from the deps layer (smaller image, no pip).
COPY --from=deps /install /usr/local

# The base image ships pre-installed jaraco.context 5.3.0 + wheel 0.45.1
# which Trivy flags (CVE-2026-23949, CVE-2026-24049). Uninstall first so
# their dist-info goes too, then install the patched versions cleanly.
RUN pip uninstall -y jaraco.context wheel && \
    pip install --no-cache-dir 'jaraco.context>=6.1.0' 'wheel>=0.46.2' && \
    rm -rf /root/.cache/pip

COPY agents/ ./agents/
COPY app/ ./app/
COPY knowledge_base/ ./knowledge_base/
COPY --from=web /web/dist ./web/dist

ARG VERSION=dev
ENV APP_VERSION=${VERSION} \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    PYTHONPATH=/app

EXPOSE 8000

RUN useradd --uid 65532 --no-create-home --shell /sbin/nologin app && \
    chown -R 65532:65532 /app
USER 65532

ENTRYPOINT ["uvicorn", "app.server:app", "--host", "0.0.0.0", "--port", "8000"]
