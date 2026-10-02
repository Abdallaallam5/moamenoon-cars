#!/usr/bin/env bash
# Put a NEW version of the site live without touching data/ or .env.
#   1. Copy the new project folder to the server (e.g. /root/moamenoon-src, replacing the old copy)
#   2. Run as root from inside it:   bash deploy/update.sh
set -euo pipefail

APP_USER=moamenoon
APP_DIR=/var/www/moamenoon
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo -i)."; exit 1; }

# safety copy of the database before changing anything
[ -x /usr/local/bin/moamenoon-backup ] && sudo -u "$APP_USER" /usr/local/bin/moamenoon-backup || true

rsync -a --delete --exclude 'node_modules' --exclude 'data' --exclude '.env' --exclude '.git' --exclude '*.zip' "$SRC_DIR"/ "$APP_DIR"/
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
cd "$APP_DIR"
sudo -u "$APP_USER" npm install --omit=dev --no-audit --no-fund
sudo -u "$APP_USER" pm2 reload moamenoon --update-env   # zero downtime
sleep 2
curl -fsS http://127.0.0.1:3000/api/health && echo "  <- updated and answering"
