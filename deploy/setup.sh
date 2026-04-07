#!/usr/bin/env bash
# deploy/setup.sh — Idempotent Ubuntu 22.04 LTS setup for parse-server production
# Safe to run multiple times on an already-configured server.

set -euo pipefail

echo "==> Starting setup for Ubuntu 22.04 LTS..."

# ── nvm ──────────────────────────────────────────────────────────────────────
if [ -d "$HOME/.nvm" ]; then
  echo "==> nvm already installed, skipping."
else
  echo "==> Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

# Source nvm so it's available in this script session
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# ── Node.js 20 ────────────────────────────────────────────────────────────────
echo "==> Installing Node.js 20..."
nvm install 20
nvm use 20
nvm alias default 20
echo "==> Node.js version: $(node --version)"

# ── yarn ──────────────────────────────────────────────────────────────────────
if command -v yarn &>/dev/null; then
  echo "==> yarn already installed ($(yarn --version)), skipping."
else
  echo "==> Installing yarn globally..."
  npm install -g yarn
fi

# ── PM2 ───────────────────────────────────────────────────────────────────────
if command -v pm2 &>/dev/null; then
  echo "==> PM2 already installed ($(pm2 --version)), skipping."
else
  echo "==> Installing PM2 globally..."
  npm install -g pm2
fi

# ── MongoDB 7.0 ───────────────────────────────────────────────────────────────
if command -v mongod &>/dev/null; then
  echo "==> MongoDB already installed ($(mongod --version | head -1)), skipping."
else
  echo "==> Installing MongoDB 7.0..."

  # Install prerequisites
  sudo apt-get update -y
  sudo apt-get install -y gnupg curl

  # Import the MongoDB public GPG key
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
    | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

  # Add the MongoDB 7.0 repository for Ubuntu 22.04 (Jammy)
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
    | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

  sudo apt-get update -y
  sudo apt-get install -y mongodb-org
fi

# ── Enable and start mongod ───────────────────────────────────────────────────
echo "==> Enabling and starting mongod service..."
sudo systemctl enable mongod
sudo systemctl start mongod
echo "==> mongod status: $(sudo systemctl is-active mongod)"

# ── PM2 boot persistence ──────────────────────────────────────────────────────
echo "==> Configuring PM2 to start on system boot..."
pm2 startup || true   # prints a command to run as root; run it manually if needed

echo "==> Saving PM2 process list..."
pm2 save

echo ""
echo "==> Setup complete."
echo "    Node.js : $(node --version)"
echo "    npm     : $(npm --version)"
echo "    yarn    : $(yarn --version)"
echo "    PM2     : $(pm2 --version)"
echo "    mongod  : $(mongod --version | head -1)"
