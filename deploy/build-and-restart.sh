#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-/var/www/html}"
if [ -n "${SEO_AUDIT_PORT:-}" ]; then
  AUDIT_PORT="$SEO_AUDIT_PORT"
else
  AUDIT_PORT="$(
    node -e 'const net=require("node:net"); const server=net.createServer(); server.on("error",(error)=>{console.error(error);process.exit(1)}); server.listen(0, "127.0.0.1",()=>{console.log(server.address().port);server.close();});'
  )"
fi
AUDIT_LOG="$(mktemp /tmp/steelprodukt-seo-audit.XXXXXX.log)"
AUDIT_PID=""
DEPLOY_LOCK="${STEELPRODUKT_DEPLOY_LOCK:-/tmp/steelprodukt-production-deploy.lock}"
CANDIDATE_DIST=".next-candidate"
PREVIOUS_DIST=".next-previous"
STATIC_COMPAT_MINUTES="${STEELPRODUKT_STATIC_COMPAT_MINUTES:-1440}"

# GitHub Actions cancels superseded workflow runs, but an SSH child can outlive
# the runner cancellation briefly. Serialize work on the Beget host as well so
# two npm installs/builds can never compete for the same limited memory.
exec 9>"$DEPLOY_LOCK"
if ! flock -w 900 9; then
  echo "Timed out waiting for another Steel Produkt production deploy to finish."
  exit 1
fi

cleanup_audit_server() {
  if [ -n "$AUDIT_PID" ] && kill -0 "$AUDIT_PID" 2>/dev/null; then
    kill "$AUDIT_PID" 2>/dev/null || true
    wait "$AUDIT_PID" 2>/dev/null || true
  fi
  rm -f "$AUDIT_LOG"
}
trap cleanup_audit_server EXIT

cd "$APP_PATH"
# Audit/funding metadata is not needed during deployment and costs extra network,
# CPU and memory on a constrained host. Dependency integrity is still enforced
# by package-lock.json through npm ci.
npm ci --no-audit --no-fund
# Keep the currently serving .next build intact while source validation runs.
# Only generated route types can become stale after App Router paths change;
# they are safe to regenerate and are not required by the running application.
rm -rf .next/types .next/dev/types
# Leftover candidate/previous trees from an interrupted deploy must not be
# linted (generated JS triggers thousands of eslint errors). Remove them before
# validation; the live .next directory stays untouched until promotion.
rm -rf "$CANDIDATE_DIST" "$PREVIOUS_DIST"
npm run env:check
npm run lint
npm run typecheck
npm run test

# The configured cluster size is applied before the build, which is by far the
# most memory-hungry step: shrinking the cluster first hands that memory back
# instead of letting the build get OOM-killed alongside surplus workers.
# pm2 scale exits non-zero with "Nothing to do" when the size already matches,
# and there is nothing running to scale before the very first deploy.
APP_NAME="$(node -p "require('./ecosystem.config.cjs').apps[0].name")"
APP_INSTANCES="$(node -p "require('./ecosystem.config.cjs').apps[0].instances")"
RUNNING_INSTANCES="$(pm2 jlist | node -pe "JSON.parse(require('fs').readFileSync(0, 'utf8')).filter((p) => p.name === '$APP_NAME').length")"
if [ "$RUNNING_INSTANCES" -gt 0 ] && [ "$RUNNING_INSTANCES" != "$APP_INSTANCES" ]; then
  pm2 scale "$APP_NAME" "$APP_INSTANCES"
fi

# Never run next build against the directory used by the live process. Next.js
# recreates build manifests during compilation; rebuilding .next in place caused
# intermittent MODULE_NOT_FOUND/ENOENT responses while users were browsing.
rm -rf "$CANDIDATE_DIST" "$PREVIOUS_DIST"
NEXT_DIST_DIR="$CANDIDATE_DIST" npm run build
# TypeScript/Next may recreate incremental compiler metadata during validation/build.
# It is not a production runtime artifact, so do not leave it on the server.
rm -f "$APP_PATH/tsconfig.tsbuildinfo"

# A browser tab opened before promotion can request an old lazy-loaded Next.js
# chunk after the new release goes live. Preserve still-recent static assets from
# the currently serving build inside the candidate so those requests continue to
# resolve instead of falling into the global error boundary. Never overwrite a
# freshly built asset with an older file, and cap retention to avoid unbounded
# accumulation over many releases.
if [ -d .next/static ]; then
  mkdir -p "$CANDIDATE_DIST/static"
  cp -a -n .next/static/. "$CANDIDATE_DIST/static/"
  if [[ "$STATIC_COMPAT_MINUTES" =~ ^[0-9]+$ ]] && [ "$STATIC_COMPAT_MINUTES" -gt 0 ]; then
    find "$CANDIDATE_DIST/static" -type f -mmin "+$STATIC_COMPAT_MINUTES" -delete
    find "$CANDIDATE_DIST/static" -depth -type d -empty -delete
  fi
fi

test -f "$CANDIDATE_DIST/required-server-files.json"
test -f "$CANDIDATE_DIST/server/middleware-manifest.json"

# Start and audit the candidate on a private free port while the current .next
# build continues serving production traffic on port 3000. Run Next directly so
# AUDIT_PID belongs to the actual server process rather than an npm wrapper that
# can exit while leaving a stale child listening on the audit port.
NEXT_DIST_DIR="$CANDIDATE_DIST" node ./node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port "$AUDIT_PORT" >"$AUDIT_LOG" 2>&1 &
AUDIT_PID="$!"

audit_ready=false
for _ in $(seq 1 30); do
  # Never accept a response from a stale server left on the port by an older
  # deploy. The process we just started must still be alive before and after the
  # readiness request succeeds.
  if ! kill -0 "$AUDIT_PID" 2>/dev/null; then
    break
  fi
  if curl -fsS "http://127.0.0.1:$AUDIT_PORT/robots.txt" >/dev/null \
    && kill -0 "$AUDIT_PID" 2>/dev/null; then
    audit_ready=true
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

wait_for_production() {
  for _ in $(seq 1 40); do
    if curl -fsS --max-time 2 "http://127.0.0.1:3000/robots.txt" >/dev/null; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

# The candidate has passed build + startup + SEO audit. Only now stop the old
# worker, swap build directories, and start the new worker. The interruption is
# limited to the short process restart instead of the full Next.js build window.
if [ "$RUNNING_INSTANCES" -gt 0 ]; then
  pm2 delete "$APP_NAME" || true
fi
if [ -d .next ]; then
  mv .next "$PREVIOUS_DIST"
fi
mv "$CANDIDATE_DIST" .next

if pm2 start ecosystem.config.cjs --env production --update-env \
  && wait_for_production \
  && SEO_AUDIT_BASE_URL="http://127.0.0.1:3000" node scripts/audit-legacy-redirects.mjs; then
  rm -rf "$PREVIOUS_DIST"
else
  echo "Candidate failed after promotion; rolling back the previous build."
  pm2 delete "$APP_NAME" || true
  rm -rf .next
  if [ -d "$PREVIOUS_DIST" ]; then
    mv "$PREVIOUS_DIST" .next
    pm2 start ecosystem.config.cjs --env production --update-env || true
    wait_for_production || true
  fi
  exit 1
fi

pm2 save

# Drop nginx page cache so visitors are not pinned to pre-deploy HTML that
# references deleted JS chunks (that combination surfaces the global-error
# "stale build" screen until the cache entry expires).
# Runs as the nodejs user after promotion — use sudo when available, and never
# fail the deploy if cache purge is denied (the app is already live).
if command -v nginx >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then
    sudo rm -rf /var/cache/nginx/steelprodukt/* 2>/dev/null || true
    if sudo nginx -t >/dev/null 2>&1; then
      sudo nginx -s reload 2>/dev/null || true
    fi
  else
    rm -rf /var/cache/nginx/steelprodukt/* 2>/dev/null || true
    if nginx -t >/dev/null 2>&1; then
      nginx -s reload 2>/dev/null || true
    fi
  fi
  echo "Nginx page cache purge attempted for steelprodukt."
fi

# Tell search engines the release is live. This runs last and on purpose is
# best-effort: the site is already serving by now, so a refused or throttled
# notification is worth reporting but must never turn a good deploy into a failed one.
if node scripts/submit-indexnow.mjs; then
  echo "IndexNow: priority URLs submitted."
else
  echo "IndexNow: notification failed. The release itself is live and healthy."
fi
