const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.steelprodukt.ru").replace(/\/$/, "");
const indexNowKey = "9f6d7c0b8a2e4f1c5d3b7a9e6c4f2d1b";
const keyLocation = `${siteUrl}/indexnow-key.txt`;
const requestedPaths = process.argv.slice(2);
const paths = requestedPaths.length
  ? requestedPaths
  : [
      "/articles",
      "/articles/vystavki-fasady-arhitektura-2026",
      "/sitemap.xml",
    ];
const urlList = paths.map((path) => new URL(path, `${siteUrl}/`).toString());

const response = await fetch("https://yandex.com/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(siteUrl).host,
    key: indexNowKey,
    keyLocation,
    urlList,
  }),
});

if (!response.ok) {
  const details = await response.text();
  throw new Error(`IndexNow returned ${response.status}: ${details || response.statusText}`);
}

console.log(`IndexNow accepted ${urlList.length} URL(s) for ${new URL(siteUrl).host}.`);
