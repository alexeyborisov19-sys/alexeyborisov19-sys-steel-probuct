import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const nginxConfig = fs.readFileSync("deploy/nginx/steelprodukt.conf", "utf8");
const prepareProduction = fs.readFileSync("deploy/prepare-production.sh", "utf8");

function serverBlocks(config: string) {
  const blocks: string[] = [];
  const marker = /\bserver\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(config))) {
    let depth = 1;
    let index = marker.lastIndex;
    for (; index < config.length && depth > 0; index += 1) {
      if (config[index] === "{") depth += 1;
      else if (config[index] === "}") depth -= 1;
    }
    blocks.push(config.slice(match.index, index));
  }
  return blocks;
}

test("nginx forces every public host variant onto the canonical HTTPS www origin", () => {
  const blocks = serverBlocks(nginxConfig);

  const httpRedirect = blocks.find((block) =>
    /listen\s+80;/.test(block)
    && /server_name\s+steelprodukt\.ru\s+www\.steelprodukt\.ru;/.test(block),
  );
  assert.ok(httpRedirect, "HTTP server block for both public hosts must exist");
  assert.match(httpRedirect, /return\s+301\s+https:\/\/www\.steelprodukt\.ru\$request_uri;/);

  const bareHttpsRedirect = blocks.find((block) =>
    /listen\s+443\s+ssl;/.test(block)
    && /server_name\s+steelprodukt\.ru;/.test(block),
  );
  assert.ok(bareHttpsRedirect, "HTTPS bare-domain redirect block must exist");
  assert.match(bareHttpsRedirect, /return\s+301\s+https:\/\/www\.steelprodukt\.ru\$request_uri;/);

  const canonicalApp = blocks.find((block) =>
    /listen\s+443\s+ssl;/.test(block)
    && /server_name\s+www\.steelprodukt\.ru;/.test(block),
  );
  assert.ok(canonicalApp, "canonical HTTPS www application block must exist");
  assert.match(canonicalApp, /proxy_pass\s+http:\/\/127\.0\.0\.1:3000;/);
});

test("production preparation installs and validates the reviewed canonical nginx config", () => {
  assert.match(
    prepareProduction,
    /install\s+-m\s+0644\s+-o\s+root\s+-g\s+root\s+"\$APP_PATH\/deploy\/nginx\/steelprodukt\.conf"\s+"\$nginx_target"/,
  );
  assert.match(prepareProduction, /if\s+!\s+nginx\s+-t;/);
  assert.match(prepareProduction, /systemctl\s+reload\s+nginx/);
});
