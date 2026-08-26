const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.steelprodukt.ru").replace(/\/$/, "");
const keyLocation = `${siteUrl}/indexnow-key.txt`;
const requestedPaths = process.argv.slice(2).filter((path) => path !== "--");
const endpoint = process.env.INDEXNOW_ENDPOINT || "https://yandex.com/indexnow";
const maxAttempts = 3;
const retryDelayMs = 3000;
const minimumSitemapPriority = 0.85;
const maximumBatchSize = 10_000;

function decodeXmlText(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

async function loadPublishedKey() {
  const response = await fetch(keyLocation, {
    headers: { "User-Agent": "SteelProdukt-IndexNow/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Could not load published IndexNow key: HTTP ${response.status}`);
  }

  const key = (await response.text()).trim();
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    throw new Error("Published IndexNow key has an invalid format");
  }

  return key;
}

async function discoverPriorityUrls() {
  const sitemapUrl = `${siteUrl}/sitemap.xml`;
  const response = await fetch(sitemapUrl, {
    headers: { "User-Agent": "SteelProdukt-IndexNow/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Could not load sitemap.xml for IndexNow: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const expectedHost = new URL(siteUrl).host;
  const urls = [];

  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const block = match[1];
    const loc = block.match(/<loc>([\s\S]*?)<\/loc>/i)?.[1];
    const priorityText = block.match(/<priority>([\s\S]*?)<\/priority>/i)?.[1];
    const priority = Number.parseFloat(priorityText?.trim() || "0");

    if (!loc || !Number.isFinite(priority) || priority < minimumSitemapPriority) continue;

    const url = new URL(decodeXmlText(loc.trim()));
    if (url.host !== expectedHost) continue;
    urls.push(url.toString());
  }

  if (!urls.length) {
    throw new Error("sitemap.xml did not contain any IndexNow priority URLs");
  }

  return [...new Set([
    ...urls,
    sitemapUrl,
    `${siteUrl}/sitemap-images.xml`,
  ])];
}

const indexNowKey = await loadPublishedKey();
const urlList = requestedPaths.length
  ? [...new Set(requestedPaths.map((path) => new URL(path, `${siteUrl}/`).toString()))]
  : await discoverPriorityUrls();

if (urlList.length > maximumBatchSize) {
  throw new Error(`IndexNow batch has ${urlList.length} URLs; maximum is ${maximumBatchSize}`);
}

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
