FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV UV_CACHE_DIR=/tmp/uv-cache

COPY pyproject.toml uv.lock* ./
RUN uv sync --no-install-project --all-groups

COPY . .
RUN uv sync --all-groups

RUN chmod +x docker-entrypoint.sh

RUN addgroup --system app && adduser --system --ingroup app app
USER app

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
