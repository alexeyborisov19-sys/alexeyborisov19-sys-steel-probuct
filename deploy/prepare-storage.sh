#!/usr/bin/env bash
set -euo pipefail

APP_USER="${1:-nodejs}"
APP_GROUP="$(id -gn "$APP_USER")"
STORAGE_ROOT="/var/lib/steelprodukt"
DIRECTORIES=(
  "$STORAGE_ROOT/quote-leads"
  "$STORAGE_ROOT/quarantine"
  "$STORAGE_ROOT/consent-audit"
  "$STORAGE_ROOT/assistant-leads"
  "$STORAGE_ROOT/admin"
  "$STORAGE_ROOT/exports"
)

install -d -m 0700 -o "$APP_USER" -g "$APP_GROUP" "$STORAGE_ROOT"

for directory in "${DIRECTORIES[@]}"; do
  install -d -m 0700 -o "$APP_USER" -g "$APP_GROUP" "$directory"
  sudo -u "$APP_USER" sh -c '
    set -eu
    directory="$1"
    test -d "$directory"
    test -w "$directory"
    test_file="$directory/.write-test.$$"
    umask 077
    : > "$test_file"
    chmod 0600 "$test_file"
    rm -f "$test_file"
  ' sh "$directory"
done

echo "Protected storage is ready for $APP_USER."
