#!/bin/bash
set -e

echo "Applying database migrations..."
/app/.venv/bin/alembic upgrade head

echo "Starting the AeroSafe API..."
# The gateway sends the client address in X-Forwarded-For and overwrites any value sent by the client.
# The API port is not published, so only the gateway reaches it: trusting every sender is safe.
# If you ever publish the port, set FORWARDED_ALLOW_IPS to the address of the gateway.
exec /app/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 \
    --proxy-headers --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}" \
    ${UVICORN_EXTRA_ARGS:---reload}
