#!/bin/sh
# Nightly database backup to the object storage bucket (R2).
# Run from the directory that holds docker-compose.yml, e.g. from cron:
#   15 3 * * * cd /srv/commutag && ./scripts/backup-mongo.sh >> log/backup.log 2>&1
# Restore:
#   download backup/mongo-<time>.archive.gz from the bucket, then
#   docker compose exec -T mongo mongorestore --archive --gzip --drop < mongo-<time>.archive.gz
set -eu
echo "[$(date -u +%FT%TZ)] backup start"
docker compose exec -T mongo mongodump --archive --gzip --db commutag \
	| docker compose exec -T commutag node scripts/backup-upload.js
echo "[$(date -u +%FT%TZ)] backup done"
