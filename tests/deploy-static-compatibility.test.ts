import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const deployScriptPath = new URL("../deploy/build-and-restart.sh", import.meta.url);

test("production deploy preserves recent Next static chunks for tabs opened before promotion", async () => {
  const source = await readFile(deployScriptPath, "utf8");

  const buildIndex = source.indexOf('NEXT_DIST_DIR="$CANDIDATE_DIST" npm run build');
  const mergeIndex = source.indexOf('cp -a -n .next/static/. "$CANDIDATE_DIST/static/"');
  const candidateStartIndex = source.indexOf('NEXT_DIST_DIR="$CANDIDATE_DIST" node ./node_modules/next/dist/bin/next start');

  assert.ok(buildIndex >= 0, "candidate build must exist");
  assert.ok(mergeIndex > buildIndex, "old static assets must be merged only after the fresh build exists");
  assert.ok(candidateStartIndex > mergeIndex, "compatibility assets must be present before candidate audit starts");
  assert.match(source, /STEELPRODUKT_STATIC_COMPAT_MINUTES:-1440/);
  assert.match(source, /find "\$CANDIDATE_DIST\/static" -type f -mmin "\+\$STATIC_COMPAT_MINUTES" -delete/);
});
