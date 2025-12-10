#!/bin/sh
set -e

# Run database migrations
echo "Running database migrations..."
uv run alembic upgrade head

# Start the application
exec "$@"
