#!/usr/bin/env bash
set -Eeuo pipefail

# Interim encrypted backup on the Russian production VPS. This protects from
# logical mistakes but does not replace an independent Russian backup target.
umask 077

BACKUP_ROOT=${PD_BACKUP_PATH:-/var/backups/steelprodukt}
KEY_FILE=${PD_BACKUP_ENCRYPTION_KEY_FILE:-/etc/steelprodukt/pd-backup.key}
LEGAL_DOCUMENTS_RELATIVE='var/www/html/app/(public)/legal'
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
ARCHIVE="$BACKUP_ROOT/steelprodukt-pd-$STAMP.tar.gz.enc"
HASH_FILE="$ARCHIVE.sha256"
REPORT="$BACKUP_ROOT/steelprodukt-pd-$STAMP.json"
RESTORE_DIR=$(mktemp -d "$BACKUP_ROOT/.restore-test.XXXXXX")

cleanup() {
  if [[ "$RESTORE_DIR" == "$BACKUP_ROOT"/.restore-test.* && -d "$RESTORE_DIR" ]]; then
    find "$RESTORE_DIR" -depth -delete
  fi
}
trap cleanup EXIT

test -r "$KEY_FILE"
install -d -m 700 -o root -g root "$BACKUP_ROOT"

ITEMS=(
  var/lib/steelprodukt/quote-leads
  var/lib/steelprodukt/assistant-leads
  var/lib/steelprodukt/consent-audit
  var/lib/steelprodukt/quarantine
  var/lib/steelprodukt/admin
  "$LEGAL_DOCUMENTS_RELATIVE"
  var/www/html/lib/legal.ts
  var/www/html/LEGAL_COMPLIANCE_RU.md
)

for item in "${ITEMS[@]}"; do
  if [[ -L "/$item" || ! -e "/$item" ]]; then
    printf 'backup source is missing or unsafe: %s\n' "$item" >&2
    exit 2
  fi
done

tar -C / --numeric-owner --acls --xattrs -czf - "${ITEMS[@]}" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
      -pass "file:$KEY_FILE" -out "$ARCHIVE"
chmod 600 "$ARCHIVE"
sha256sum "$ARCHIVE" > "$HASH_FILE"
chmod 600 "$HASH_FILE"

openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -pass "file:$KEY_FILE" -in "$ARCHIVE" \
  | tar -C "$RESTORE_DIR" --no-same-owner --no-same-permissions -xzf -

FILE_COUNT=$(python3 - "$RESTORE_DIR" "$LEGAL_DOCUMENTS_RELATIVE" <<'PY'
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

restore_root = Path(sys.argv[1])
source_root = Path("/")
legal_documents_relative = sys.argv[2]
items = (
    "var/lib/steelprodukt/quote-leads",
    "var/lib/steelprodukt/assistant-leads",
    "var/lib/steelprodukt/consent-audit",
    "var/lib/steelprodukt/quarantine",
    "var/lib/steelprodukt/admin",
    legal_documents_relative,
    "var/www/html/lib/legal.ts",
    "var/www/html/LEGAL_COMPLIANCE_RU.md",
)

def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()

def collect(root: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for relative in items:
        candidate = root / relative
        if candidate.is_symlink():
            raise RuntimeError("symlink found in backup source")
        if candidate.is_file():
            result[relative] = digest(candidate)
            continue
        for file_path in candidate.rglob("*"):
            if file_path.is_symlink():
                raise RuntimeError("symlink found in backup source")
            if file_path.is_file():
                result[str(file_path.relative_to(root))] = digest(file_path)
    return result

source = collect(source_root)
restored = collect(restore_root)
if source != restored:
    raise SystemExit("restore verification failed")
print(len(source))
PY
)

ARCHIVE_HASH=$(cut -d ' ' -f 1 "$HASH_FILE")
ARCHIVE_BYTES=$(stat -c %s "$ARCHIVE")

printf '%s\n' \
  "{" \
  "  \"created_at\": \"$STAMP\"," \
  "  \"storage_country\": \"RU\"," \
  "  \"storage_type\": \"encrypted_local_same_vps\"," \
  "  \"encrypted\": true," \
  "  \"archive_sha256\": \"$ARCHIVE_HASH\"," \
  "  \"archive_bytes\": $ARCHIVE_BYTES," \
  "  \"files_verified\": $FILE_COUNT," \
  "  \"restore_tested\": true," \
  "  \"production_overwritten\": false," \
  "  \"limitation\": \"Interim copy on the same VPS; an independent Russian storage target is still required.\"" \
  "}" > "$REPORT"
chmod 600 "$REPORT"

printf 'backup=%s\nsha256=%s\nfiles_verified=%s\nrestore_tested=true\n' \
  "$ARCHIVE" "$ARCHIVE_HASH" "$FILE_COUNT"
