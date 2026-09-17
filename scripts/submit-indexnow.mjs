const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.steelprodukt.ru").replace(/\/$/, "");
const keyLocation = `${siteUrl}/indexnow-key.txt`;
const requestedPaths = process.argv.slice(2).filter((path) => path !== "--");
const endpoint = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";
const maxAttempts = 4;
const retryDelayMs = 3000;
// Article pages carry priority 0.8 in the sitemap, so a 0.85 floor silently dropped
// every one of them from IndexNow. The floor has to track that tier, not sit above it.
// Everything below stays out: legal pages are 0.2 and the fallback tier is 0.75.
const minimumSitemapPriority = 0.8;
const maximumBatchSize = 10_000;

function decodeXmlText(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

async function delay(attempt) {
  await new Promise((resolve) => setTimeout(resolve, attempt * retryDelayMs));
}

async function loadTextWithRetry(url, label) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "SteelProdukt-IndexNow/1.1" },
        cache: "no-store",
      });
      if (response.ok) return await response.text();
      lastError = new Error(`${label}: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < maxAttempts) {
      console.warn(`${label} is not ready yet; retry ${attempt}/${maxAttempts}.`);
      await delay(attempt);
    }
  }

  throw lastError;
}

async function loadPublishedKey() {
  const key = (await loadTextWithRetry(keyLocation, "Could not load published IndexNow key")).trim();
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    throw new Error("Published IndexNow key has an invalid format");
  }
  return key;
}

async function discoverPriorityUrls() {
  const sitemapUrl = `${siteUrl}/sitemap.xml`;
  const xml = await loadTextWithRetry(sitemapUrl, "Could not load sitemap.xml for IndexNow");
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
    `${siteUrl}/llms.txt`,
    `${siteUrl}/llms-full.txt`,
    `${siteUrl}/robots.txt`,
    sitemapUrl,
    `${siteUrl}/sitemap-images.xml`,
  ])];
}

const indexNowKey = await loadPublishedKey();
const priorityUrls = await discoverPriorityUrls();
const requestedUrls = requestedPaths.map((path) => new URL(path, `${siteUrl}/`).toString());
const urlList = [...new Set([...priorityUrls, ...requestedUrls])];

if (urlList.length > maximumBatchSize) {
  throw new Error(`IndexNow batch has ${urlList.length} URLs; maximum is ${maximumBatchSize}`);
}

async function submit(body) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) await delay(attempt - 1);

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

console.log(`IndexNow accepted ${urlList.length} URL(s) for ${new URL(siteUrl).host} via ${endpoint}.`);
