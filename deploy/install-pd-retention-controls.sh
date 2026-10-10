#!/usr/bin/env bash
set -Eeuo pipefail
APP_PATH=${1:-/var/www/html}
[[ "$APP_PATH" == /var/www/html ]] || { echo 'Unexpected application path'; exit 1; }
# Required release gate: verify the existing fresh local/S3 copy before the
# application is promoted. The root-owned source is pinned by the verifier;
# neither backup creation, upload, rotation nor export deletion runs here.
/usr/bin/python3 /usr/local/sbin/steelprodukt-verify-offsite-recovery \
  /usr/local/sbin/steelprodukt-pd-offsite-backup --verify-only

# Existing daily policy stays active. Starting an inactive persistent timer can
# immediately catch up a missed deletion job, so deployment must not enable it.
for name in steelprodukt-pd-retention-check steelprodukt-pd-export-expiry; do
  systemctl is-active "$name.timer"
done

for name in steelprodukt-pd-retention-check steelprodukt-pd-export-expiry; do
  install -m 0644 -o root -g root "$APP_PATH/deploy/systemd/$name.service" "/etc/systemd/system/$name.service"
  install -m 0644 -o root -g root "$APP_PATH/deploy/systemd/$name.timer" "/etc/systemd/system/$name.timer"
done
install -m 0644 -o root -g root "$APP_PATH/deploy/systemd/steelprodukt-pd-offsite-backup.service" /etc/systemd/system/steelprodukt-pd-offsite-backup.service
systemctl daemon-reload
if ! systemctl start steelprodukt-pd-retention-check.service; then
  echo "Retention check needs attention; see protected retention-monitor.json and service status."
fi
for name in steelprodukt-pd-retention-check steelprodukt-pd-export-expiry; do
  systemctl is-active "$name.timer"
done
