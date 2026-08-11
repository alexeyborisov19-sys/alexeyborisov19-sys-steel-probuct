import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { NextRequest } from "next/server";
import sitemap from "@/app/sitemap";
import { GET as robots } from "@/app/robots.txt/route";
import { middleware } from "@/middleware";

test("disabled PD administration returns a no-store 404", () => {
  const previous = process.env.PD_ADMIN_ENABLED;
  process.env.PD_ADMIN_ENABLED = "false";
  try {
    const response = middleware(new NextRequest("https://www.steelprodukt.ru/internal/personal-data"));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  } finally {
    if (previous === undefined) delete process.env.PD_ADMIN_ENABLED;
    else process.env.PD_ADMIN_ENABLED = previous;
  }
});

test("disabled PD administration also blocks the exact internal API root", () => {
  const previous = process.env.PD_ADMIN_ENABLED;
  process.env.PD_ADMIN_ENABLED = "false";
  try {
    const response = middleware(new NextRequest("https://www.steelprodukt.ru/api/internal/personal-data"));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  } finally {
    if (previous === undefined) delete process.env.PD_ADMIN_ENABLED;
    else process.env.PD_ADMIN_ENABLED = previous;
  }
});

test("internal routes stay out of sitemap and are disallowed for crawlers", async () => {
  assert.equal(sitemap().some((entry) => new URL(entry.url).pathname.startsWith("/internal/")), false);
  const body = await robots().text();
  assert.match(body, /Disallow: \/internal\//);
});

test("Node production and temporary audit servers bind only to loopback", async () => {
  const ecosystem = await readFile("ecosystem.config.cjs", "utf8");
  const deployment = await readFile("deploy/build-and-restart.sh", "utf8");
  assert.match(ecosystem, /start -H 127\.0\.0\.1 -p 3000/);
  assert.match(deployment, /--hostname 127\.0\.0\.1/);
});

test("Stage 3 Nginx delegates the disabled-by-default gate to the application", async () => {
  const nginx = await readFile("deploy/nginx/steelprodukt.conf", "utf8");
  assert.doesNotMatch(nginx, /location \^~ \/internal\/personal-data[\s\S]*?return 404;/);
  assert.match(nginx, /PD_ADMIN_ENABLED=false returns 404/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3000;/);
});

test("enabled internal middleware applies nonce CSP and private anti-index headers", () => {
  const previous = process.env.PD_ADMIN_ENABLED;
  process.env.PD_ADMIN_ENABLED = "true";
  try {
    const response = middleware(new NextRequest("https://www.steelprodukt.ru/internal/personal-data/login"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("content-security-policy") || "", /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    assert.doesNotMatch(response.headers.get("content-security-policy") || "", /mc\.yandex/);
  } finally {
    if (previous === undefined) delete process.env.PD_ADMIN_ENABLED;
    else process.env.PD_ADMIN_ENABLED = previous;
  }
});

test("production internal middleware requires the canonical HTTPS reverse proxy", () => {
  const previousEnabled = process.env.PD_ADMIN_ENABLED;
  const previousEnvironment = process.env.NODE_ENV;
  const mutable = process.env as Record<string, string | undefined>;
  mutable.PD_ADMIN_ENABLED = "true";
  mutable.NODE_ENV = "production";
  try {
    const rejected = middleware(new NextRequest("https://www.steelprodukt.ru/internal/personal-data/login", {
      headers: { host: "www.steelprodukt.ru", "x-forwarded-host": "www.steelprodukt.ru", "x-forwarded-proto": "http" },
    }));
    assert.equal(rejected.status, 404);
    const allowed = middleware(new NextRequest("https://www.steelprodukt.ru/internal/personal-data/login", {
      headers: { host: "www.steelprodukt.ru", "x-forwarded-host": "www.steelprodukt.ru", "x-forwarded-proto": "https" },
    }));
    assert.equal(allowed.status, 200);
  } finally {
    if (previousEnabled === undefined) delete mutable.PD_ADMIN_ENABLED;
    else mutable.PD_ADMIN_ENABLED = previousEnabled;
    if (previousEnvironment === undefined) delete mutable.NODE_ENV;
    else mutable.NODE_ENV = previousEnvironment;
  }
});

test("legacy destructive cleanup is explicitly marked risky and is not run by Stage 2", async () => {
  const cleanup = await readFile("scripts/cleanup-expired-leads.mjs", "utf8");
  const retention = await readFile("docs/personal-data-retention.md", "utf8");
  assert.match(cleanup, /LEGACY_RISKY_APPLY/);
  assert.match(retention, /--apply.*запускать запрещено/);
});
