#!/bin/bash
# Placeholder solution entrypoint — candidate/scaffold stub.
# Exits 0 so the harness proceeds to tests/test.sh; the smoke check only verifies
# that the harness executes end-to-end, not that the reward is >= 1.0.
#
# The reference publisher (publisher/release-publisher.mjs) is authored and graded
# separately by a human; no solution is included in this folder.
#!/bin/bash
#!/bin/sh

#!/bin/sh

set -e

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