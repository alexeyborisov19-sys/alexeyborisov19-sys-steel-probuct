import { request } from "node:http";

const baseUrl = (process.env.SEO_AUDIT_BASE_URL ?? "http://127.0.0.1:3011").replace(/\/$/, "");
const canonicalOrigin = "https://www.steelprodukt.ru";

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
  ["/krihki", "/products/parapetnye-kryshki"],
  ["/fasad", "/products/metallokassety"],
  ["/metalkaset", "/products/metallokassety"],
  ["/articles;", "/articles"],
  ["/contacts;", "/contacts"],
  ["/production;", "/production"],
  ["/products;", "/products"],
]);

const retiredUrls = [
  "/preload",
  "/articles/preload",
    "/products/preload",
  "/industries/preload",
  "/tpost/8k5t28gnc1-there-is-a-first-post-headline",
  "/tpost/0h4a9f3hn1-title-of-the-second-sample-post",
  "/tpost/rd16su7hd1-the-third-title-for-the-post",
  "/chugunnoe-lityo",
];

const errors = [];

for (const [source, destination] of legacyRedirects) {
  const response = await fetch(`${baseUrl}${source}`, { redirect: "manual" });
  if (response.status !== 301) {
    errors.push(`${source}: ожидается 301, получен ${response.status}`);
    continue;
  }

  const location = response.headers.get("location");
  if (!location) {
    errors.push(`${source}: отсутствует Location`);
    continue;
  }

  const resolved = new URL(location, canonicalOrigin);
  const expected = new URL(destination, canonicalOrigin);
  if (resolved.href !== expected.href) {
    errors.push(`${source}: редирект ведёт на ${resolved.href} вместо ${expected.href}`);
  }
}

// Exercise the actual Next redirect manifest, including query preservation.
for (const host of ["saquapequoke.beget.app", "www.saquapequoke.beget.app"]) {
  const path = "/products/metallokassety?utm_source=seo_redirect_check";
  const local = ["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname);
  // Node fetch replaces a custom Host header; use the HTTP client for local
  // virtual-host checks so the built Next server receives the intended host.
  const result = local
    ? await new Promise((resolve, reject) => {
      const req = request(`${baseUrl}${path}`, { headers: { host } }, (response) => {
        response.resume();
        resolve({ status: response.statusCode, location: response.headers.location });
      });
      req.on("error", reject);
      req.setTimeout(15000, () => req.destroy(new Error("Host redirect check timed out")));
      req.end();
    })
    : await fetch(`https://${host}${path}`, { redirect: "manual" }).then((response) => ({
      status: response.status,
      location: response.headers.get("location"),
    }));
  if (result.status !== 308 || result.location !== `${canonicalOrigin}${path}`) {
    errors.push(`${host}: expected permanent canonical redirect preserving path and query, got ${result.status} ${result.location}`);
  }
}

for (const path of retiredUrls) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (response.status !== 410) {
    errors.push(`${path}: ожидается 410, получен ${response.status}`);
  }
  const robots = (response.headers.get("x-robots-tag") ?? "").toLowerCase();
  if (!robots.includes("noindex")) {
    errors.push(`${path}: удалённый URL не содержит X-Robots-Tag noindex`);
  }
}

console.log(`SEO-аудит legacy-редиректов: ${legacyRedirects.size} редиректов, ${retiredUrls.length} удалённых URL`);
console.log(`Ошибки: ${errors.length}`);
if (errors.length) {
  errors.forEach((error) => console.log(`- ${error}`));
  process.exitCode = 1;
}
