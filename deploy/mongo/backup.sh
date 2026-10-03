#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
BACKUP_DIR="${BACKUP_DIR:-$HOME/barangay-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/bims-$STAMP.archive.gz"

docker exec barangay-mongo sh -c 'mongodump --quiet \
  --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin --db "$MONGO_APP_DATABASE" --archive --gzip' > "$FILE.partial"

mv "$FILE.partial" "$FILE"
chmod 600 "$FILE"

if ! gzip -t "$FILE"; then
  echo "Backup file failed integrity check: $FILE" >&2
  exit 1
fi

find "$BACKUP_DIR" -name 'bims-*.archive.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
