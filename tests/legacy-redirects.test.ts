import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import sitemap from "@/app/sitemap";
import { config as middlewareConfig, middleware } from "@/middleware";
import nextConfig from "@/next.config";

const legacyRedirects = new Map([
  ["/articles/ezhednevnaya-svodka-rossiya-politika-promyshlennost-28-07-2026", "/articles"],
  ["/articles/ezhednevnaya-svodka-metalloobrabotka-proizvodstvo-28-07-2026", "/articles"],
  ["/krovla", "/products"],
  ["/lomedii", "/products"],
  ["/otdekrf", "/products"],
  ["/dekorattivnie", "/products"],
  ["/dimli", "/solutions/engineering"],
  ["/korzina", "/products/korziny-dlya-konditsionerov"],
  ["/kronhtein", "/solutions/engineering"],
  ["/rehotka", "/solutions/engineering"],
  ["/vnutri", "/production/lazernaya-rezka-metalla"],
]);

for (const [source, destination] of legacyRedirects) {
  test(`${source} redirects directly to ${destination}`, () => {
    const response = middleware(new NextRequest(`https://www.steelprodukt.ru${source}`));

    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("location"),
      `https://www.steelprodukt.ru${destination}`,
    );
  });
}

test("middleware matcher covers every legacy content redirect", () => {
  const matchers = new Set(middlewareConfig.matcher);

  for (const source of legacyRedirects.keys()) {
    assert.equal(matchers.has(source), true, `${source}: missing from middleware matcher`);
  }
});

test("Next.js redirect manifest does not preempt legacy middleware redirects", async () => {
  const redirects = await (nextConfig as {
    redirects: () => Promise<Array<{ source: string }>>;
  }).redirects();

  for (const source of legacyRedirects.keys()) {
    assert.equal(
      redirects.some((item) => item.source === source),
      false,
      `${source}: legacy redirect must have a single owner in middleware`,
    );
  }
});

test("legacy URLs are excluded from sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  for (const legacyPath of legacyRedirects.keys()) {
    assert.equal(urls.some((url) => new URL(url).pathname === legacyPath), false);
  }
});


test("retired product preloader returns 410 and cannot enter the sitemap", () => {
  const path = "/products/preload";
  assert.ok(middlewareConfig.matcher.includes(path));
  const response = middleware(new NextRequest(`https://www.steelprodukt.ru${path}`));
  assert.equal(response.status, 410);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.ok(!sitemap().some((entry) => new URL(entry.url).pathname === path));
});

test("both technical hosting aliases permanently redirect to the canonical domain", async () => {
  const redirects = await nextConfig.redirects!();
  for (const host of ["saquapequoke.beget.app", "www.saquapequoke.beget.app"]) {
    const redirect = redirects.find((rule) => rule.has?.some(
      (condition) => condition.type === "host" && new RegExp(`^${condition.value}$`).test(host),
    ));
    assert.ok(redirect, `${host}: technical duplicate remains accessible`);
    assert.equal(redirect.source, "/:path*");
    assert.equal(redirect.destination, "https://www.steelprodukt.ru/:path*");
    assert.equal(redirect.permanent, true);
  }
});
