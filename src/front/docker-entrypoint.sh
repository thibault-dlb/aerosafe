#!/bin/sh
set -e

# Generate the runtime configuration from the environment
cat <<CONFIG > /usr/share/nginx/html/config.js
window.RUNTIME_CONFIG = {
  apiBaseUrl: "${VITE_API_URL:-http://localhost:8888/api}"
};
CONFIG

exec "$@"
