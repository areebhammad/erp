# =============================================================================
# Stage 1: Builder — install dependencies into a virtual env
# =============================================================================
FROM python:3.13-slim AS builder

# Suppress debconf frontend warnings (no TTY in Podman/Docker build)
ENV DEBIAN_FRONTEND=noninteractive

# System deps needed to compile some wheels (asyncpg, cryptography, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libssl-dev \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create an isolated venv so we can copy it cleanly to the runtime stage
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy project metadata — hatchling needs BOTH pyproject.toml AND README.md
# (hatchling validates `readme = "README.md"` at metadata-generation time)
COPY pyproject.toml README.md ./

# Install all production dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir .

# =============================================================================
# Stage 2: Runtime — lean image with only what's needed to run
# =============================================================================
FROM python:3.13-slim AS runtime

LABEL maintainer="ERP Team <team@erp.com>" \
    description="AI-First ERP Backend — FastAPI" \
    version="0.1.0"

# Suppress debconf frontend warnings (no TTY in Podman/Docker build)
ENV DEBIAN_FRONTEND=noninteractive

# Runtime system deps only (libpq for asyncpg, libssl for cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for security
# Podman rootless maps the host UID automatically; we still define one
# so the image is explicit and works in both rootless and rootful modes.
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy the pre-built venv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application source
COPY --chown=appuser:appgroup app/ ./app/
COPY --chown=appuser:appgroup alembic/ ./alembic/
COPY --chown=appuser:appgroup alembic.ini ./

# Directory for RSA keys (mounted at runtime via secret / volume)
RUN mkdir -p /app/keys && chown appuser:appgroup /app/keys

# Switch to non-root user
USER appuser

# Expose the API port
EXPOSE 8000

# Health check — uses the /health endpoint we already have
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command: run uvicorn in production mode
CMD ["uvicorn", "app.main:app", \
    "--host", "0.0.0.0", \
    "--port", "8000", \
    "--workers", "4", \
    "--loop", "uvloop", \
    "--http", "httptools", \
    "--access-log"]
