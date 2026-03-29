#!/bin/sh

export CHARTDB_SYNC_UPSTREAM="${CHARTDB_SYNC_UPSTREAM:-chartdb-sync:8080}"
export DIAGRAM_SYNC_API_ENABLED="${DIAGRAM_SYNC_API_ENABLED:-false}"
export DIAGRAM_SYNC_POLL_MS="${DIAGRAM_SYNC_POLL_MS:-30000}"
export DIAGRAM_SYNC_API_BASE="${DIAGRAM_SYNC_API_BASE:-/api/diagram-sync}"
export DIAGRAM_SYNC_TOKEN="${DIAGRAM_SYNC_TOKEN:-}"

# Replace placeholders in nginx.conf
envsubst '${OPENAI_API_KEY} ${OPENAI_API_ENDPOINT} ${LLM_MODEL_NAME} ${HIDE_CHARTDB_CLOUD} ${DISABLE_ANALYTICS} ${CHARTDB_SYNC_UPSTREAM} ${DIAGRAM_SYNC_API_ENABLED} ${DIAGRAM_SYNC_POLL_MS} ${DIAGRAM_SYNC_API_BASE} ${DIAGRAM_SYNC_TOKEN}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start Nginx
nginx -g "daemon off;"
