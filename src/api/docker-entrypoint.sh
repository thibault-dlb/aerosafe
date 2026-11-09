#!/bin/bash
set -e

echo "Applying database migrations..."
/app/.venv/bin/alembic upgrade head

echo "Starting the AeroSafe API..."
exec /app/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 ${UVICORN_EXTRA_ARGS:---reload}
