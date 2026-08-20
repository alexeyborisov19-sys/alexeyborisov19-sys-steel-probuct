import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import sitemap from "@/app/sitemap";
import { middleware } from "@/middleware";
import nextConfig from "@/next.config";

const retiredRedirects = new Map([
  ["/vnutri", "/production/lazernaya-rezka-metalla"],
  ["/dimli", "/solutions/engineering"],
  ["/rehotka", "/solutions/engineering"],
  ["/korzina", "/solutions/climate"],
]);

for (const [source, destination] of retiredRedirects) {
  test(`${source} redirects directly to ${destination}`, () => {
    const response = middleware(new NextRequest(`https://www.steelprodukt.ru${source}`));

    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("location"),
      `https://www.steelprodukt.ru${destination}`,
    );
  });
}

test("Next.js redirect configuration does not override retired URLs with 308 or another destination", async () => {
  const redirects = await (nextConfig as {
    redirects: () => Promise<Array<{ source: string; destination: string; statusCode?: number }>>;
  }).redirects();

  for (const [source, destination] of retiredRedirects) {
    const redirect = redirects.find((item) => item.source === source);

    assert.ok(redirect, `${source}: redirect missing from Next.js configuration`);
    assert.equal(redirect.destination, destination);
    assert.equal(redirect.statusCode, 301);
  }
});

test("retired URLs are excluded from sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  for (const retiredPath of retiredRedirects.keys()) {
    assert.equal(urls.some((url) => new URL(url).pathname === retiredPath), false);
  }
});
