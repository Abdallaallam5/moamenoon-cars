#!/usr/bin/env bash
# Daily backup (installed as /usr/local/bin/moamenoon-backup and run by cron at 03:30).
#  - the database: a consistent snapshot (safe while the site is live), kept for 14 days
#  - the photos: they never change after upload, so a simple incremental copy is enough
# Copy /var/backups/moamenoon OFF the server too (another machine, Google Drive/Dropbox with rclone, ...) - a backup
# that lives only on the same server does not survive losing the server.
set -euo pipefail

APP=/var/www/moamenoon
DEST="${BACKUP_DIR:-/var/backups/moamenoon}"
STAMP="$(date +%F)"

mkdir -p "$DEST/db" "$DEST/uploads"
cd "$APP"
DATA_DIR="$APP/data" node --disable-warning=ExperimentalWarning scripts/backup.js "$DEST/db/app-$STAMP.db"
rsync -a "$APP/data/uploads/" "$DEST/uploads/"
find "$DEST/db" -name 'app-*.db' -mtime +14 -delete
echo "$(date -Is) backup ok: $(du -sh "$DEST" | cut -f1) total"
