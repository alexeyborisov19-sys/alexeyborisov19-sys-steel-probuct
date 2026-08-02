import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import sitemap from "@/app/sitemap";
import { middleware } from "@/middleware";

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

test("retired URLs are excluded from sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  for (const retiredPath of retiredRedirects.keys()) {
    assert.equal(urls.some((url) => new URL(url).pathname === retiredPath), false);
  }
});
