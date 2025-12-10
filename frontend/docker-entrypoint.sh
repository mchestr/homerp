#!/bin/sh
set -e

# Generate runtime environment config
# This injects environment variables into the client-side bundle at runtime
cat <<EOF > /app/public/__env.js
window.__ENV__ = {
  API_URL: "${NEXT_PUBLIC_API_URL:-http://localhost:8000}"
};
EOF

exec "$@"
