#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-/var/www/html}"
AUDIT_PORT="${SEO_AUDIT_PORT:-3011}"
AUDIT_LOG="$(mktemp /tmp/steelprodukt-seo-audit.XXXXXX.log)"
AUDIT_PID=""

cleanup_audit_server() {
  if [ -n "$AUDIT_PID" ] && kill -0 "$AUDIT_PID" 2>/dev/null; then
    kill "$AUDIT_PID" 2>/dev/null || true
    wait "$AUDIT_PID" 2>/dev/null || true
  fi
  rm -f "$AUDIT_LOG"
}
trap cleanup_audit_server EXIT

cd "$APP_PATH"
npm ci
# Generated route types from the previous release must not participate in
# typecheck after App Router paths have changed.
rm -rf .next
npm run env:check
npm run lint
npm run typecheck
npm run test
npm run build

npm run start -- --hostname 127.0.0.1 --port "$AUDIT_PORT" >"$AUDIT_LOG" 2>&1 &
AUDIT_PID="$!"

audit_ready=false
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$AUDIT_PORT/robots.txt" >/dev/null; then
    audit_ready=true
    break
  fi
  if ! kill -0 "$AUDIT_PID" 2>/dev/null; then
    break
  fi
  sleep 1
done

if [ "$audit_ready" != true ]; then
  echo "Temporary SEO audit server did not become ready."
  tail -n 40 "$AUDIT_LOG"
  exit 1
fi

SEO_AUDIT_BASE_URL="http://127.0.0.1:$AUDIT_PORT" npm run seo:audit
cleanup_audit_server
AUDIT_PID=""
trap - EXIT

pm2 startOrReload ecosystem.config.cjs --env production --update-env

# startOrReload restarts the processes that are already running but keeps their
# current count, so a changed cluster size is applied explicitly. The number is
# read back from the ecosystem file to keep a single source of truth.
# pm2 scale exits non-zero with "Nothing to do" when the size already matches,
# so the current count is compared first.
APP_NAME="$(node -p "require('./ecosystem.config.cjs').apps[0].name")"
APP_INSTANCES="$(node -p "require('./ecosystem.config.cjs').apps[0].instances")"
RUNNING_INSTANCES="$(pm2 jlist | node -pe "JSON.parse(require('fs').readFileSync(0, 'utf8')).filter((p) => p.name === '$APP_NAME').length")"
if [ "$RUNNING_INSTANCES" != "$APP_INSTANCES" ]; then
  pm2 scale "$APP_NAME" "$APP_INSTANCES"
fi

pm2 save
