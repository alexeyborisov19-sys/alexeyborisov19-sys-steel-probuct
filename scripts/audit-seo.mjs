const baseUrl = (process.env.SEO_AUDIT_BASE_URL ?? "http://127.0.0.1:3011").replace(/\/$/, "");
const canonicalOrigin = "https://www.steelprodukt.ru";

function decodeHtml(value = "") {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function tagAttribute(tag, name) {
  const match = tag.match(new RegExp(`${name}=(?:\"([^\"]*)\"|'([^']*)')`, "i"));
  return decodeHtml(match?.[1] ?? match?.[2] ?? "");
}

function findMeta(html, name) {
  const tag = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((candidate) => tagAttribute(candidate, "name").toLowerCase() === name.toLowerCase());
  return tag ? tagAttribute(tag, "content") : "";
}

function findMetaProperty(html, property) {
  const tag = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((candidate) => tagAttribute(candidate, "property").toLowerCase() === property.toLowerCase());
  return tag ? tagAttribute(tag, "content") : "";
}

function findLink(html, rel) {
  const tag = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((candidate) => tagAttribute(candidate, "rel").toLowerCase().split(/\s+/).includes(rel.toLowerCase()));
  return tag ? tagAttribute(tag, "href") : "";
}

function findCanonical(html) {
  return findLink(html, "canonical");
}

function schemaTypes(html) {
  const types = new Set();
  const blocks = [...html.matchAll(/<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi)];

  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    const type = value["@type"];
    if (Array.isArray(type)) type.forEach((item) => types.add(item));
    else if (typeof type === "string") types.add(type);
    Object.values(value).forEach(visit);
  }

  for (const block of blocks) {
    try {
      visit(JSON.parse(block[1]));
    } catch {
      types.add("INVALID_JSON_LD");
    }
  }
  return types;
}

function expectedSchemaTypes(path) {
  const expected = ["Organization", "LocalBusiness", "WebSite", "WebPage"];
  if (path !== "/") expected.push("BreadcrumbList");
  if (["/production", "/industries", "/products"].includes(path)) expected.push("ItemList");
  if (path === "/products/metallokassety") expected.push("ProductGroup");
  if (path.startsWith("/production/")) expected.push("Service", "FAQPage");
  if (path.startsWith("/solutions/")) expected.push("Service");
  if (path.startsWith("/industries/")) expected.push("Service", "ItemList", "FAQPage");
  if (
    path.startsWith("/products/")
    && path !== "/products/metallokassety"
    && path !== "/products/dobornye-elementy"
  ) expected.push("Product", "FAQPage");
  if (
    path.startsWith("/articles/")
    && ![
      "/articles/china-tech",
      "/articles/vystavki-metalloobrabotka-kitay-2026",
      "/articles/vystavki-fasady-arhitektura-2026",
    ].includes(path)
  ) expected.push("Article");
  return expected;
}

function pathFromUrl(value) {
  const url = new URL(value);
  return `${url.pathname}${url.search}`;
}

function normalizedCanonical(value) {
  const url = new URL(value);
  return `${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")}${url.search}`;
}

function pagePath(value) {
  const url = new URL(value, canonicalOrigin);
  return `${url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "")}${url.search}`;
}

function imagePathForAudit(src) {
  const url = new URL(src, canonicalOrigin);
  if (url.pathname === "/_next/image") {
    const sourcePath = url.searchParams.get("url");
    if (sourcePath?.startsWith("/")) return sourcePath;
  }
  return `${url.pathname}${url.search}`;
}

function internalLink(href, base) {
  if (!href || /^(?:mailto:|tel:|javascript:|data:)/i.test(href)) return null;
  try {
    const url = new URL(href, base);
    if (!["www.steelprodukt.ru", "steelprodukt.ru"].includes(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function headingLevels(html) {
  return [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
}

function hasElementId(html, id) {
  return [...html.matchAll(/<[^>]+\bid=(?:"([^"]*)"|'([^']*)')[^>]*>/gi)]
    .some((match) => decodeHtml(match[1] ?? match[2] ?? "") === id);
}

function visibleText(html) {
  return decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

async function getText(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  return { response, text: await response.text() };
}

const errors = [];
const warnings = [];
const retiredRedirects = new Map([
  ["/vnutri", "/production/lazernaya-rezka-metalla"],
  ["/dimli", "/solutions/engineering"],
  ["/rehotka", "/solutions/engineering"],
  ["/korzina", "/solutions/climate"],
]);
const retiredPaths = new Set(retiredRedirects.keys());

const robots = await getText("/robots.txt");
if (robots.response.status !== 200) errors.push(`robots.txt вернул ${robots.response.status}`);
if (/Disallow:\s*\/\s*$/im.test(robots.text)) errors.push("robots.txt запрещает обход всего сайта");
if (!robots.text.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`)) errors.push("robots.txt не содержит основной sitemap");
if (!robots.text.includes(`Sitemap: ${canonicalOrigin}/sitemap-images.xml`)) errors.push("robots.txt не содержит sitemap изображений");
if ((robots.text.match(/^User-agent:\s*\*$/gim) ?? []).length !== 1) errors.push("robots.txt должен содержать один общий блок User-agent: *");
if (!/^Disallow:\s*\/api\/\s*$/im.test(robots.text)) errors.push("robots.txt не закрывает технический раздел /api/");
if (/^User-agent:\s*(?:Yandex|Googlebot)\s*$/im.test(robots.text)) {
  errors.push("Отдельная секция поискового робота может отменить общий запрет /api/; используйте единый блок User-agent: *");
}
if (!/^Clean-param:\s*utm_source&/im.test(robots.text)) errors.push("robots.txt не содержит Clean-param для рекламных параметров");

const sitemap = await getText("/sitemap.xml");
if (sitemap.response.status !== 200) errors.push(`sitemap.xml вернул ${sitemap.response.status}`);

const urls = [...sitemap.text.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => decodeHtml(match[1]));
const lastModified = [...sitemap.text.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map((match) => match[1]);
const changeFrequencies = [...sitemap.text.matchAll(/<changefreq>(.*?)<\/changefreq>/g)].map((match) => match[1]);
const priorities = [...sitemap.text.matchAll(/<priority>(.*?)<\/priority>/g)].map((match) => Number(match[1]));
if (!urls.length) errors.push("sitemap.xml не содержит URL");
if (new Set(urls).size !== urls.length) errors.push("В sitemap.xml есть повторяющиеся URL");
if (urls.some((url) => !url.startsWith(`${canonicalOrigin}/`) && url !== `${canonicalOrigin}/`)) {
  errors.push("В sitemap.xml найдены URL не на основном www-домене");
}
if (lastModified.some((value) => Number.isNaN(Date.parse(value)))) errors.push("В sitemap.xml есть некорректные lastmod");
if (lastModified.length !== urls.length) errors.push("Не у каждого URL в sitemap.xml указан lastmod");
if (changeFrequencies.length !== urls.length) errors.push("Не у каждого URL в sitemap.xml указан changefreq");
if (priorities.length !== urls.length || priorities.some((value) => value < 0 || value > 1)) {
  errors.push("В sitemap.xml отсутствуют или некорректны priority");
}
if (lastModified.some((value) => Date.parse(value) > Date.now() + 24 * 60 * 60 * 1000)) {
  errors.push("В sitemap.xml есть lastmod из будущего");
}
for (const retiredPath of retiredPaths) {
  if (urls.some((url) => pagePath(url) === retiredPath)) {
    errors.push(`В sitemap.xml найден устаревший URL ${retiredPath}`);
  }
}

const imageSitemap = await getText("/sitemap-images.xml");
if (imageSitemap.response.status !== 200) errors.push(`sitemap-images.xml вернул ${imageSitemap.response.status}`);
if (!imageSitemap.text.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')) {
  errors.push("sitemap-images.xml не содержит пространство имён изображений");
}
if (!/<image:loc>https:\/\/www\.steelprodukt\.ru\//.test(imageSitemap.text)) {
  errors.push("sitemap-images.xml не содержит изображений основного домена");
}

for (const artifactPath of ["/feed.xml", "/llms.txt", "/llms-full.txt"]) {
  const artifact = await getText(artifactPath);
  if (artifact.response.status !== 200) errors.push(`${artifactPath} вернул ${artifact.response.status}`);
  if (artifact.text.trim().length < 100) errors.push(`${artifactPath} содержит слишком мало данных`);
}

for (const assetPath of ["/manifest.webmanifest", "/icon.svg"]) {
  const asset = await getText(assetPath);
  if (asset.response.status !== 200) errors.push(`${assetPath} вернул ${asset.response.status}`);
}

const results = [];
const pageHtml = new Map();
const internalLinkRecords = [];
const imagePaths = new Set();
for (const publicUrl of urls) {
  const path = pathFromUrl(publicUrl);
  const { response, text: html } = await getText(path);
  const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "");
  const description = findMeta(html, "description");
  const canonical = findCanonical(html);
  const robotsMeta = findMeta(html, "robots").toLowerCase();
  const robotsHeader = (response.headers.get("x-robots-tag") ?? "").toLowerCase();
  const types = schemaTypes(html);
  const h1Count = [...html.matchAll(/<h1\b[^>]*>/gi)].length;
  const levels = headingLevels(html);
  const words = visibleText(html).split(/\s+/).filter(Boolean).length;
  const links = [...html.matchAll(/<a\b[^>]*href=(?:"([^"]*)"|'([^']*)')[^>]*>/gi)]
    .map((match) => decodeHtml(match[1] ?? match[2] ?? ""));
  const internalLinks = links.map((href) => internalLink(href, publicUrl)).filter(Boolean);
  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const ogTitle = findMetaProperty(html, "og:title");
  const ogDescription = findMetaProperty(html, "og:description");
  const ogUrl = findMetaProperty(html, "og:url");
  const ogImage = findMetaProperty(html, "og:image");
  const twitterCard = findMeta(html, "twitter:card");
  const htmlLanguage = html.match(/<html\b[^>]*\blang=(?:"([^"]*)"|'([^']*)')/i)?.[1]
    ?? html.match(/<html\b[^>]*\blang=(?:"([^"]*)"|'([^']*)')/i)?.[2]
    ?? "";

  if (response.status !== 200) errors.push(`${path}: HTTP ${response.status}`);
  if (!title) errors.push(`${path}: отсутствует title`);
  if (!description) errors.push(`${path}: отсутствует description`);
  if (!canonical || normalizedCanonical(canonical) !== normalizedCanonical(publicUrl)) {
    errors.push(`${path}: canonical «${canonical || "нет"}» вместо «${publicUrl}»`);
  }
  if (robotsMeta.includes("noindex")) errors.push(`${path}: обнаружен noindex`);
  if (robotsHeader.includes("noindex")) errors.push(`${path}: X-Robots-Tag содержит noindex`);
  if (h1Count !== 1) errors.push(`${path}: ожидается один H1, найдено ${h1Count}`);
  if (words < 80) errors.push(`${path}: вероятно пустой контент (${words} слов)`);
  if (internalLinks.length < 3) warnings.push(`${path}: мало внутренних ссылок (${internalLinks.length})`);
  if (types.has("INVALID_JSON_LD")) errors.push(`${path}: некорректный JSON-LD`);
  if (htmlLanguage.toLowerCase() !== "ru") errors.push(`${path}: отсутствует корректный lang=\"ru\"`);
  if (!ogTitle || !ogDescription || !ogImage || !ogUrl) errors.push(`${path}: неполный набор Open Graph`);
  if (ogUrl && normalizedCanonical(ogUrl) !== normalizedCanonical(publicUrl)) {
    errors.push(`${path}: og:url «${ogUrl}» не совпадает с canonical`);
  }
  if (ogImage && !ogImage.startsWith(`${canonicalOrigin}/`)) errors.push(`${path}: og:image не является абсолютным URL основного домена`);
  if (!twitterCard) errors.push(`${path}: отсутствует twitter:card`);
  if (!findLink(html, "manifest")) errors.push(`${path}: отсутствует ссылка на webmanifest`);
  if (!findLink(html, "icon")) errors.push(`${path}: отсутствует favicon`);

  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index] > levels[index - 1] + 1) {
      warnings.push(`${path}: скачок заголовков H${levels[index - 1]} → H${levels[index]}`);
      break;
    }
  }

  for (const tag of imageTags) {
    const src = tagAttribute(tag, "src");
    const nextImageMode = tagAttribute(tag, "data-nimg").toLowerCase();
    if (!/\balt=(?:"[^"]*"|'[^']*')/i.test(tag)) errors.push(`${path}: у изображения ${src || "(без src)"} отсутствует alt`);
    if ((!tagAttribute(tag, "width") || !tagAttribute(tag, "height")) && nextImageMode !== "fill") {
      warnings.push(`${path}: у изображения ${src || "(без src)"} не заданы width/height`);
    }
    if (
      !tagAttribute(tag, "loading")
      && tagAttribute(tag, "fetchpriority").toLowerCase() !== "high"
      && !nextImageMode
    ) {
      warnings.push(`${path}: у изображения ${src || "(без src)"} не задан режим загрузки`);
    }
    if (src.startsWith("/")) imagePaths.add(imagePathForAudit(src));
  }

  for (const type of expectedSchemaTypes(path)) {
    if (!types.has(type)) errors.push(`${path}: отсутствует schema.org ${type}`);
  }

  if (title.length < 30 || title.length > 75) warnings.push(`${path}: длина title ${title.length} символов`);
  if (description.length < 80 || description.length > 190) warnings.push(`${path}: длина description ${description.length} символов`);

  if (path.startsWith("/articles/")) {
    const commercialLinks = [
      "/production",
      "/products",
      "/solutions",
      "/industries",
      "/calculator-metallokassety",
      "/contacts",
    ].filter((href) => html.includes(`href="${href}`));
    if (commercialLinks.length < 2) warnings.push(`${path}: меньше двух ссылок на коммерческие разделы`);
  }

  for (const url of internalLinks) {
    internalLinkRecords.push({ from: path, url });
    if (retiredPaths.has(url.pathname)) {
      errors.push(`${path}: внутренняя ссылка ведёт на устаревший URL ${url.pathname}`);
    }
    if (url.hostname !== "www.steelprodukt.ru") {
      warnings.push(`${path}: внутренняя ссылка ведёт через неканонический домен ${url.href}`);
    }
  }

  pageHtml.set(path, html);
  results.push({ path, title, description, html });
}

const targetCache = new Map();
for (const { from, url } of internalLinkRecords) {
  const targetPath = pagePath(url.href);
  const fetchPath = url.pathname + url.search;
  if (!targetCache.has(fetchPath)) targetCache.set(fetchPath, await getText(fetchPath));
  const target = targetCache.get(fetchPath);
  if (target.response.status >= 300) {
    const kind = target.response.status >= 400 ? "битая ссылка" : "ссылка через редирект";
    errors.push(`${from}: ${kind} ${url.pathname}${url.search} (HTTP ${target.response.status})`);
  }
  if (url.hash) {
    const targetDocument = pageHtml.get(targetPath) ?? target.text;
    if (!hasElementId(targetDocument, decodeURIComponent(url.hash.slice(1)))) {
      errors.push(`${from}: ссылка ${url.pathname}${url.hash} указывает на отсутствующий якорь`);
    }
  }
}

const inbound = new Map(urls.map((url) => [pagePath(url), new Set()]));
for (const { from, url } of internalLinkRecords) {
  const targetPath = pagePath(url.href);
  if (targetPath !== from && inbound.has(targetPath)) inbound.get(targetPath).add(from);
}
for (const [path, sources] of inbound) {
  if (path !== "/" && sources.size === 0) errors.push(`${path}: orphan page — нет входящих внутренних ссылок`);
}

for (const imagePath of imagePaths) {
  const image = await getText(imagePath);
  if (image.response.status !== 200) errors.push(`${imagePath}: изображение вернуло HTTP ${image.response.status}`);
  if (!(image.response.headers.get("content-type") ?? "").startsWith("image/")) {
    errors.push(`${imagePath}: сервер не вернул графический Content-Type`);
  }
}

const legacyRedirect = await getText("/address");
if (legacyRedirect.response.status !== 301) errors.push(`/address: ожидается 301, получен ${legacyRedirect.response.status}`);
for (const [source, destination] of retiredRedirects) {
  const retiredRedirect = await getText(source);
  if (retiredRedirect.response.status !== 301) {
    errors.push(`${source}: ожидается 301, получен ${retiredRedirect.response.status}`);
  } else {
    const location = new URL(retiredRedirect.response.headers.get("location") ?? "", canonicalOrigin).href;
    const expectedLocation = `${canonicalOrigin}${destination}`;
    if (location !== expectedLocation) {
      errors.push(`${source}: редирект ведёт на ${location} вместо ${expectedLocation}`);
    }
  }
}
const removedLegacy = await getText("/chugunnoe-lityo");
if (removedLegacy.response.status !== 410) errors.push(`/chugunnoe-lityo: ожидается 410, получен ${removedLegacy.response.status}`);
if (!(removedLegacy.response.headers.get("x-robots-tag") ?? "").toLowerCase().includes("noindex")) {
  errors.push("/chugunnoe-lityo: удалённый URL не содержит X-Robots-Tag noindex");
}

const apiRoute = await getText("/api/quote");
if (!(apiRoute.response.headers.get("x-robots-tag") ?? "").toLowerCase().includes("noindex")) {
  errors.push("/api/quote: технический endpoint не содержит X-Robots-Tag noindex");
}

const missingPage = await getText("/seo-audit-nonexistent-page");
if (missingPage.response.status !== 404) errors.push(`/seo-audit-nonexistent-page: ожидается 404, получен ${missingPage.response.status}`);
if (
  !findMeta(missingPage.text, "robots").toLowerCase().includes("noindex")
  && !(missingPage.response.headers.get("x-robots-tag") ?? "").toLowerCase().includes("noindex")
) {
  errors.push("/seo-audit-nonexistent-page: страница 404 не содержит noindex");
}

const utmPage = await getText("/?utm_source=seo-audit");
if (utmPage.response.status !== 200) errors.push(`UTM-версия главной вернула ${utmPage.response.status}`);
if (normalizedCanonical(findCanonical(utmPage.text)) !== normalizedCanonical(`${canonicalOrigin}/`)) {
  errors.push("UTM-параметр попал в canonical главной страницы");
}

for (const field of ["title", "description"]) {
  const groups = new Map();
  for (const result of results) {
    const value = result[field];
    if (!value) continue;
    groups.set(value, [...(groups.get(value) ?? []), result.path]);
  }
  for (const paths of groups.values()) {
    if (paths.length > 1) errors.push(`Повторяющийся ${field}: ${paths.join(", ")}`);
  }
}

console.log(`SEO-аудит: ${results.length} URL из sitemap.xml`);
console.log(`Ошибки: ${errors.length}; предупреждения: ${warnings.length}`);
if (errors.length) {
  console.log("\nОШИБКИ");
  errors.forEach((item) => console.log(`- ${item}`));
}
if (warnings.length) {
  console.log("\nПРЕДУПРЕЖДЕНИЯ");
  warnings.forEach((item) => console.log(`- ${item}`));
}

if (errors.length) process.exitCode = 1;
