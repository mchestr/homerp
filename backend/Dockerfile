FROM python:3.14-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock README.md ./

# Install dependencies
RUN uv sync --no-dev --frozen

# Copy source code
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# Create uploads directory
RUN mkdir -p /app/uploads

# Copy entrypoint script
COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

# Expose port
EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
