# syntax=docker/dockerfile:1.6
#
# Stromteilung backend — multi-stage Dockerfile.
#
# Stage 1 (builder) installs Python deps via `uv` into an isolated virtualenv,
# using BuildKit cache mounts so subsequent rebuilds are near-instant when
# only the source code changes.
#
# Stage 2 (runtime) drops uv, build tools and apt caches — the final image is
# just slim Python + the pre-baked `.venv`.
#
# Heroku binds dynos to `$PORT` at runtime; the CMD respects it.

# ============================================================================
# Stage 1 — builder
# ============================================================================
FROM python:3.12-slim-bookworm AS builder

# Pin uv to a specific tag for reproducible builds.
COPY --from=ghcr.io/astral-sh/uv:0.4 /uv /usr/local/bin/uv

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# 1. Install dependencies first — this layer caches until lockfiles change.
#    `--no-install-project` skips installing our own code so source edits
#    don't bust this cache.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# 2. Now copy source and install the project itself.
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev


# ============================================================================
# Stage 2 — runtime
# ============================================================================
FROM python:3.12-slim-bookworm AS runtime

# `tini` reaps zombies and forwards signals — important on Heroku, which
# sends SIGTERM for restarts and expects a clean shutdown.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

WORKDIR /app

# Bring the prepared venv + application code over from the builder stage.
COPY --from=builder /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Heroku doesn't honour EXPOSE — kept for clarity / local `docker run -P`.
EXPOSE 8000

# `tini -- exec` so PID 1 is tini, which forwards SIGTERM to uvicorn cleanly.
# - `--proxy-headers` + `--forwarded-allow-ips='*'` trust the X-Forwarded-*
#   set by Heroku's router so request.client.host etc. are correct.
# - Two workers is the sweet spot for an Eco/Basic dyno; tune up on Performance.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 2 --proxy-headers --forwarded-allow-ips='*'"]
