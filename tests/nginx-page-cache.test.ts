import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const nginxConfig = fs.readFileSync("deploy/nginx/steelprodukt.conf", "utf8");

function publicLocationBlock(config: string) {
  const start = config.indexOf("    location / {");
  assert.ok(start >= 0, "the public location block must exist");
  let depth = 1;
  let index = config.indexOf("{", start) + 1;
  for (; index < config.length && depth > 0; index += 1) {
    if (config[index] === "{") depth += 1;
    else if (config[index] === "}") depth -= 1;
  }
  return config.slice(start, index);
}

test("the page cache honours its own ten-minute lifetime", () => {
  const block = publicLocationBlock(nginxConfig);

  // Next.js sends Cache-Control: s-maxage=31536000 for prerendered pages, and
  // nginx is a shared cache that obeys s-maxage. Without this directive the
  // configured ten minutes never applied and cached HTML outlived the build it
  // referenced — the pre-deploy page kept requesting JS chunks the next release
  // had already deleted.
  assert.match(block, /proxy_ignore_headers Cache-Control Expires;/);
  assert.match(block, /proxy_cache_valid 200 10m;/);

  const ignore = block.indexOf("proxy_ignore_headers");
  const validity = block.indexOf("proxy_cache_valid 200 10m;");
  assert.ok(validity < ignore, "the lifetime this restores should read before the directive");
});

test("ignoring upstream cache headers does not widen what is cached", () => {
  const block = publicLocationBlock(nginxConfig);

  // The directive above stops nginx from reading the upstream's caching intent,
  // so the perimeter must not depend on that intent. It does not: the skip map
  // both bypasses the cache and refuses to store, for every route under /api/
  // and /internal/.
  assert.match(block, /proxy_cache_bypass \$steelprodukt_skip_cache \$http_authorization;/);
  assert.match(block, /proxy_no_cache \$steelprodukt_skip_cache \$http_authorization;/);

  const map = nginxConfig.slice(
    nginxConfig.indexOf("map $request_uri $steelprodukt_skip_cache"),
    nginxConfig.indexOf("server {"),
  );
  assert.match(map, /~\^\/api\/\s+1;/);
  assert.match(map, /~\^\/internal\/\s+1;/);

  // Only successful pages and misses are storable. Redirects and gone pages are
  // cheap to recompute, and a stale 301 pinned here would be far more expensive
  // than the hit it saves while the site is still moving its main mirror.
  const storable = (block.match(/proxy_cache_valid (\d+) /g) ?? [])
    .map((line) => line.replace(/\D/g, ""))
    .sort();
  assert.deepEqual(storable, ["200", "404"]);
  assert.match(block, /proxy_cache_methods GET HEAD;/);
});
