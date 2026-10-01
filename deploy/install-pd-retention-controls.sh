#!/usr/bin/env bash
set -Eeuo pipefail
APP_PATH=${1:-/var/www/html}
[[ "$APP_PATH" == /var/www/html ]] || { echo 'Unexpected application path'; exit 1; }
# Install only after the new release has successfully started. Never enable
# deletion of leads without their separately reviewed legal grounds.
for name in steelprodukt-pd-retention-check steelprodukt-pd-export-expiry; do
  install -m 0644 -o root -g root "$APP_PATH/deploy/systemd/$name.service" "/etc/systemd/system/$name.service"
  install -m 0644 -o root -g root "$APP_PATH/deploy/systemd/$name.timer" "/etc/systemd/system/$name.timer"
done
systemctl daemon-reload
systemctl enable --now steelprodukt-pd-retention-check.timer steelprodukt-pd-export-expiry.timer
if ! systemctl start steelprodukt-pd-retention-check.service; then
  echo "Retention check needs attention; see protected retention-monitor.json and service status."
fi
systemctl start steelprodukt-pd-export-expiry.service
systemctl is-active steelprodukt-pd-retention-check.timer steelprodukt-pd-export-expiry.timer
