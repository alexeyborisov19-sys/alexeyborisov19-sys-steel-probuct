const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.steelprodukt.ru").replace(/\/$/, "");
const indexNowKey = "9f6d7c0b8a2e4f1c5d3b7a9e6c4f2d1b";
const keyLocation = `${siteUrl}/indexnow-key.txt`;
const requestedPaths = process.argv.slice(2).filter((path) => path !== "--");
const paths = requestedPaths.length
  ? requestedPaths
  : [
      "/",
      "/production",
      "/production/proektirovanie-metalloizdeliy",
      "/production/lazernaya-rezka-metalla",
      "/production/gibka-listovogo-metalla",
      "/production/svarka-i-sborka-metalloizdeliy",
      "/production/poroshkovaya-okraska-metalla",
      "/solutions",
      "/industries",
      "/products",
      "/articles",
      "/articles/vystavki-fasady-arhitektura-2026",
      "/sitemap.xml",
      "/sitemap-images.xml",
    ];
const urlList = paths.map((path) => new URL(path, `${siteUrl}/`).toString());

const endpoint = process.env.INDEXNOW_ENDPOINT || "https://yandex.com/indexnow";
const maxAttempts = 3;
const retryDelayMs = 3000;

// The connection to the endpoint gets dropped often enough that a single try
// loses the notification without anyone noticing. A refused or reset connection
// submits nothing, so retrying it is safe; so is a 5xx or a 429. A 4xx describes
// a request that will not become valid on its own and is reported immediately.
async function submit(body) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, (attempt - 1) * retryDelayMs));
    }

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
      });
    } catch (error) {
      lastError = error;
      console.warn(`IndexNow attempt ${attempt}/${maxAttempts} could not reach the endpoint: ${error.cause?.code ?? error.message}`);
      continue;
    }

    if (response.ok) return;

    const details = await response.text();
    lastError = new Error(`IndexNow returned ${response.status}: ${details || response.statusText}`);
    if (response.status < 500 && response.status !== 429) throw lastError;
    console.warn(`IndexNow attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);
  }

  throw lastError;
}

await submit(JSON.stringify({
  host: new URL(siteUrl).host,
  key: indexNowKey,
  keyLocation,
  urlList,
}));

console.log(`IndexNow accepted ${urlList.length} URL(s) for ${new URL(siteUrl).host}.`);
