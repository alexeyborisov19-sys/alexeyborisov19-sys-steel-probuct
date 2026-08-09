#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

LOCAL_BACKUP_COMMAND=${PD_LOCAL_BACKUP_COMMAND:-/usr/local/sbin/steelprodukt-pd-backup}
BACKUP_ROOT=${PD_BACKUP_PATH:-/var/backups/steelprodukt}
KEY_FILE=${PD_BACKUP_ENCRYPTION_KEY_FILE:-/etc/steelprodukt/pd-backup.key}
RCLONE_CONFIG=${PD_OFFSITE_RCLONE_CONFIG:-/etc/steelprodukt/rclone.conf}
REMOTE=${PD_OFFSITE_REMOTE:-beget_pd_backup:0b1412a79c88-steelprodukt-backup/production}
RETENTION_DAYS=${PD_OFFSITE_RETENTION_DAYS:-30}

test -x "$LOCAL_BACKUP_COMMAND"
test -r "$KEY_FILE"
test -r "$RCLONE_CONFIG"

"$LOCAL_BACKUP_COMMAND" >/dev/null

ARCHIVE=$(find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'steelprodukt-pd-*.tar.gz.enc' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d ' ' -f 2-)
test -n "$ARCHIVE"
HASH_FILE="$ARCHIVE.sha256"
REPORT="${ARCHIVE%.tar.gz.enc}.json"
test -r "$HASH_FILE"
test -r "$REPORT"

ARCHIVE_NAME=$(basename "$ARCHIVE")
HASH_NAME=$(basename "$HASH_FILE")
REPORT_NAME=$(basename "$REPORT")
EXPECTED_HASH=$(cut -d ' ' -f 1 "$HASH_FILE")
VERIFY_DIR=$(mktemp -d "$BACKUP_ROOT/.offsite-verify.XXXXXX")

cleanup() {
  if [[ "$VERIFY_DIR" == "$BACKUP_ROOT"/.offsite-verify.* && -d "$VERIFY_DIR" ]]; then
    find "$VERIFY_DIR" -depth -delete
  fi
}
trap cleanup EXIT

rclone --config "$RCLONE_CONFIG" copyto "$ARCHIVE" "$REMOTE/$ARCHIVE_NAME" --s3-no-check-bucket --s3-acl private --no-traverse
rclone --config "$RCLONE_CONFIG" copyto "$HASH_FILE" "$REMOTE/$HASH_NAME" --s3-no-check-bucket --s3-acl private --no-traverse
rclone --config "$RCLONE_CONFIG" copyto "$REPORT" "$REMOTE/$REPORT_NAME" --s3-no-check-bucket --s3-acl private --no-traverse
rclone --config "$RCLONE_CONFIG" copyto "$REMOTE/$ARCHIVE_NAME" "$VERIFY_DIR/$ARCHIVE_NAME" --s3-no-check-bucket --no-traverse

DOWNLOADED_HASH=$(sha256sum "$VERIFY_DIR/$ARCHIVE_NAME" | cut -d ' ' -f 1)
test "$DOWNLOADED_HASH" = "$EXPECTED_HASH"

RESTORED_FILES=$(openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -pass "file:$KEY_FILE" -in "$VERIFY_DIR/$ARCHIVE_NAME" \
  | tar -tzf - | awk 'NF { count += 1 } END { print count + 0 }')
test "$RESTORED_FILES" -gt 0

rclone --config "$RCLONE_CONFIG" delete "$REMOTE" \
  --s3-no-check-bucket \
  --min-age "${RETENTION_DAYS}d" \
  --include 'steelprodukt-pd-*' \
  --rmdirs=false

printf 'offsite_backup=ok\nremote=beget_s3_ru1\nsha256_verified=true\nrestore_stream_verified=true\nitems_in_archive=%s\nretention_days=%s\n' \
  "$RESTORED_FILES" "$RETENTION_DAYS"
