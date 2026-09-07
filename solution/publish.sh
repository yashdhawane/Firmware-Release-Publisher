#!/bin/sh
set -e

cp /solution/release-publisher.mjs /app/publisher/release-publisher.mjs
cd /app


node distribution-gateway/server.js &
SERVER_PID=$!

cleanup() {
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
}

trap cleanup EXIT

sleep 2

npm run report