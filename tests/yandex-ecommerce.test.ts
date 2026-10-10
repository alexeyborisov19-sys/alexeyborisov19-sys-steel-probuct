import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const analyticsSource = readFileSync("components/Analytics.tsx", "utf8");
const ecommerceSource = readFileSync("components/YandexEcommerce.tsx", "utf8");
const publicLayoutSource = readFileSync("app/(public)/layout.tsx", "utf8");

test("Yandex ecommerce is consent-gated and uses the canonical dataLayer container", () => {
  assert.match(analyticsSource, /window\.dataLayer = window\.dataLayer \|\| \[\]/);
  assert.match(analyticsSource, /ecommerce:\s*\"dataLayer\"/);
  assert.match(ecommerceSource, /hasAnalyticsConsent\(\)/);
  assert.match(publicLayoutSource, /<YandexEcommerce \/>/);
});

test("B2B ecommerce reports catalog interest without inventing online sales", () => {
  assert.match(ecommerceSource, /impressions: products/);
  assert.match(ecommerceSource, /detail:\s*\{/);
  assert.doesNotMatch(ecommerceSource, /purchase:\s*\{/);
  assert.doesNotMatch(ecommerceSource, /add:\s*\{/);
  assert.doesNotMatch(ecommerceSource, /remove:\s*\{/);
  assert.doesNotMatch(ecommerceSource, /revenue:\s*/);
  assert.doesNotMatch(ecommerceSource, /price:\s*/);
});

test("revocation resets the catalog-interest marker so regrant emits only the current page", async () => {
  const { transformSync } = await import("esbuild");
  const { runInNewContext } = await import("node:vm");
  let permitted = true;
  const target = Object.assign(new EventTarget(), { location: { origin: "https://www.steelprodukt.ru" }, dataLayer: [] as unknown[] });
  const compiledModule = { exports: {} as { YandexEcommerce(): void } };
  let cleanup = () => {};
  runInNewContext(transformSync(ecommerceSource, { loader: "tsx", format: "cjs" }).code, {
    module: compiledModule, exports: compiledModule.exports, window: target, URL,
    document: { querySelectorAll: () => [{ textContent: JSON.stringify({ "@type": "Product", name: "Current product", url: "/products/current" }) }] },
    require(name: string) {
      if (name === "react") return { useEffect: (effect: () => () => void) => { cleanup = effect(); } };
      if (name === "next/navigation") return { usePathname: () => "/products/current" };
      if (name === "./CookieConsent") return { consentEvent: "consent", hasAnalyticsConsent: () => permitted };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  compiledModule.exports.YandexEcommerce();
  assert.equal(target.dataLayer.length, 1);
  permitted = false;
  target.dispatchEvent(new Event("consent"));
  target.dataLayer.length = 0; // The consent gate/lifecycle owns queue cleanup.
  permitted = true;
  target.dispatchEvent(new Event("consent"));
  target.dispatchEvent(new Event("consent"));
  assert.equal(target.dataLayer.length, 1);
  assert.match(JSON.stringify(target.dataLayer), /current/);
  cleanup();
});
