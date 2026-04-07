#!/usr/bin/env bash
# deploy/upgrade.sh — safe upgrade with rollback
# Upgrades parse-server and parse-dashboard, smoke-tests, and rolls back on failure.

set -euo pipefail

# Change to project root
cd "$(dirname "$0")/.."

BACKUP_DIR="/tmp/parse-server-backup"
HEALTH_TIMEOUT=10
SLEEP_AFTER_START=5

echo "[upgrade] Starting upgrade process..."

# ---------------------------------------------------------------------------
# Backup
# ---------------------------------------------------------------------------
echo "[upgrade] Backing up package.json and yarn.lock to ${BACKUP_DIR}..."
mkdir -p "${BACKUP_DIR}"
cp package.json "${BACKUP_DIR}/package.json"
cp yarn.lock    "${BACKUP_DIR}/yarn.lock"

# ---------------------------------------------------------------------------
# Rollback helper (called on smoke-test failure)
# ---------------------------------------------------------------------------
rollback() {
  echo "[upgrade] Smoke test failed — rolling back..."
  cp "${BACKUP_DIR}/package.json" package.json
  cp "${BACKUP_DIR}/yarn.lock"    yarn.lock
  echo "[upgrade] Restoring node_modules from backup lockfile..."
  yarn install --frozen-lockfile
  echo "[upgrade] Restarting server from restored state..."
  pm2 restart parse-server
  echo "[upgrade] Rollback complete. Server restarted from previous version."
  exit 1
}

# ---------------------------------------------------------------------------
# Stop server
# ---------------------------------------------------------------------------
echo "[upgrade] Stopping server via PM2..."
pm2 stop parse-server

# ---------------------------------------------------------------------------
# Upgrade parse-server and parse-dashboard only
# ---------------------------------------------------------------------------
echo "[upgrade] Upgrading parse-server and parse-dashboard to latest..."
yarn upgrade parse-server parse-dashboard --latest

echo "[upgrade] Reinstalling dependencies from updated lockfile..."
yarn install --frozen-lockfile

# ---------------------------------------------------------------------------
# Verify Node.js version satisfies engines field
# ---------------------------------------------------------------------------
echo "[upgrade] Verifying Node.js version against engines field in package.json..."
node -e "
  const pkg = require('./package.json');
  const engines = (pkg.engines && pkg.engines.node) || '';
  if (!engines) {
    console.log('[upgrade] No engines.node field found — skipping version check.');
    process.exit(0);
  }
  // Parse minimum version from constraint like '>=20.0.0'
  const match = engines.match(/>=\s*(\d+)/);
  if (!match) {
    console.log('[upgrade] Cannot parse engines.node constraint: ' + engines + ' — skipping check.');
    process.exit(0);
  }
  const required = parseInt(match[1], 10);
  const current  = parseInt(process.versions.node.split('.')[0], 10);
  if (current < required) {
    console.error('[upgrade] ERROR: Node.js v' + process.versions.node +
      ' does not satisfy engines requirement: ' + engines);
    process.exit(1);
  }
  console.log('[upgrade] Node.js v' + process.versions.node +
    ' satisfies engines requirement: ' + engines);
"

# ---------------------------------------------------------------------------
# Start server
# ---------------------------------------------------------------------------
echo "[upgrade] Starting server via PM2..."
pm2 start ecosystem.config.js --env production

echo "[upgrade] Waiting ${SLEEP_AFTER_START}s for server to initialise..."
sleep "${SLEEP_AFTER_START}"

# ---------------------------------------------------------------------------
# Read PORT from .env or default to 1337
# ---------------------------------------------------------------------------
PORT=1337
if [ -f .env ]; then
  PARSED_PORT=$(grep -E '^NODE_PORT=' .env | cut -d'=' -f2 | tr -d '[:space:]"'"'" || true)
  if [ -n "${PARSED_PORT}" ]; then
    PORT="${PARSED_PORT}"
  fi
fi

HEALTH_URL="http://localhost:${PORT}/health"
echo "[upgrade] Smoke-testing ${HEALTH_URL}..."

# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------
HTTP_STATUS=$(curl --silent --output /dev/null --write-out "%{http_code}" \
  --max-time "${HEALTH_TIMEOUT}" "${HEALTH_URL}" || echo "000")

if [ "${HTTP_STATUS}" = "200" ]; then
  echo "[upgrade] Smoke test passed (HTTP ${HTTP_STATUS}). Upgrade complete."
else
  echo "[upgrade] Smoke test failed (HTTP ${HTTP_STATUS})."
  rollback
fi
