#!/usr/bin/env bash
set -euo pipefail

# Move to the project root (parent of the deploy/ directory)
cd "$(dirname "$0")/.."

echo "[start.sh] Working directory: $(pwd)"

# Copy .env.example to .env only if .env does not already exist
if [ ! -f .env ]; then
  echo "[start.sh] No .env found — copying .env.example to .env"
  cp .env.example .env
  echo "[start.sh] .env created. Edit it with your production values before proceeding."
else
  echo "[start.sh] .env already exists — skipping copy"
fi

# Install dependencies
echo "[start.sh] Installing dependencies..."
yarn install --frozen-lockfile

# Start the server with PM2
echo "[start.sh] Starting server with PM2..."
pm2 start ecosystem.config.js --env production

echo "[start.sh] Done."
