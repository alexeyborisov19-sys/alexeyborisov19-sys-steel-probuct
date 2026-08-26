import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import sitemap from "@/app/sitemap";
import { middleware } from "@/middleware";
import nextConfig from "@/next.config";

const middlewareRedirects = new Map([
  ["/vnutri", "/production/lazernaya-rezka-metalla"],
  ["/dimli", "/solutions/engineering"],
  ["/rehotka", "/solutions/engineering"],
  ["/korzina", "/solutions/climate"],
]);

const legacyRedirects = new Map([
  ["/articles/ezhednevnaya-svodka-rossiya-politika-promyshlennost-28-07-2026", "/articles"],
  ["/articles/ezhednevnaya-svodka-metalloobrabotka-proizvodstvo-28-07-2026", "/articles"],
  ["/krovla", "/products"],
  ["/lomedii", "/products"],
  ["/otdekrf", "/products"],
  ["/dekorattivnie", "/products"],
  ["/dimli", "/solutions/engineering"],
  ["/korzina", "/solutions/climate"],
  ["/kronhtein", "/solutions/engineering"],
  ["/rehotka", "/solutions/engineering"],
  ["/vnutri", "/production/lazernaya-rezka-metalla"],
]);

for (const [source, destination] of middlewareRedirects) {
  test(`${source} redirects directly to ${destination}`, () => {
    const response = middleware(new NextRequest(`https://www.steelprodukt.ru${source}`));

    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("location"),
      `https://www.steelprodukt.ru${destination}`,
    );
  });
}

test("all legacy content redirects use one direct explicit 301", async () => {
  const redirects = await (nextConfig as {
    redirects: () => Promise<Array<{ source: string; destination: string; statusCode?: number }>>;
  }).redirects();

  for (const [source, destination] of legacyRedirects) {
    const redirect = redirects.find((item) => item.source === source);

    assert.ok(redirect, `${source}: redirect missing from Next.js configuration`);
    assert.equal(redirect.destination, destination);
    assert.equal(redirect.statusCode, 301, `${source}: legacy content redirect must be HTTP 301`);
  }
});

test("legacy URLs are excluded from sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  for (const legacyPath of legacyRedirects.keys()) {
    assert.equal(urls.some((url) => new URL(url).pathname === legacyPath), false);
  }
});
