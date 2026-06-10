# ─── Stage 1: build client ──────────────────────────────────────────────
FROM node:20-alpine AS client
WORKDIR /app

# Install deps first (cached unless lockfile changes).
COPY package.json package-lock.json ./
RUN npm ci

# Source, then build. Output lands in /app/dist.
COPY . .
RUN npm run build

# ─── Stage 2: server runtime ────────────────────────────────────────────
FROM python:3.13-slim AS server
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# The simulator runs in the browser — the server is just a static host.
RUN pip install \
    "fastapi>=0.115" \
    "uvicorn[standard]>=0.32"

COPY server/mutatiom/ ./mutatiom/
COPY --from=client /app/dist ./mutatiom/static

EXPOSE 8000
CMD ["uvicorn", "mutatiom.app:app", "--host", "0.0.0.0", "--port", "8000"]
