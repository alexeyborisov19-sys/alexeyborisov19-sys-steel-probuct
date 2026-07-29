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

function findCanonical(html) {
  const tag = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((candidate) => tagAttribute(candidate, "rel").toLowerCase().split(/\s+/).includes("canonical"));
  return tag ? tagAttribute(tag, "href") : "";
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
  const expected = ["Organization", "WebSite", "WebPage"];
  if (path !== "/") expected.push("BreadcrumbList");
  if (["/production", "/industries", "/products"].includes(path)) expected.push("ItemList");
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

async function getText(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  return { response, text: await response.text() };
}

const errors = [];
const warnings = [];

const robots = await getText("/robots.txt");
if (robots.response.status !== 200) errors.push(`robots.txt вернул ${robots.response.status}`);
if (/Disallow:\s*\/\s*$/im.test(robots.text)) errors.push("robots.txt запрещает обход всего сайта");
if (!robots.text.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`)) errors.push("robots.txt не содержит основной sitemap");
if (!robots.text.includes(`Sitemap: ${canonicalOrigin}/sitemap-images.xml`)) errors.push("robots.txt не содержит sitemap изображений");
if (!robots.text.includes("User-agent: Yandex")) warnings.push("В robots.txt нет отдельной секции Yandex");

const sitemap = await getText("/sitemap.xml");
if (sitemap.response.status !== 200) errors.push(`sitemap.xml вернул ${sitemap.response.status}`);

const urls = [...sitemap.text.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => decodeHtml(match[1]));
const lastModified = [...sitemap.text.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map((match) => match[1]);
if (!urls.length) errors.push("sitemap.xml не содержит URL");
if (new Set(urls).size !== urls.length) errors.push("В sitemap.xml есть повторяющиеся URL");
if (urls.some((url) => !url.startsWith(`${canonicalOrigin}/`) && url !== `${canonicalOrigin}/`)) {
  errors.push("В sitemap.xml найдены URL не на основном www-домене");
}
if (lastModified.some((value) => Number.isNaN(Date.parse(value)))) errors.push("В sitemap.xml есть некорректные lastmod");

const imageSitemap = await getText("/sitemap-images.xml");
if (imageSitemap.response.status !== 200) errors.push(`sitemap-images.xml вернул ${imageSitemap.response.status}`);
if (!imageSitemap.text.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')) {
  errors.push("sitemap-images.xml не содержит пространство имён изображений");
}
if (!/<image:loc>https:\/\/www\.steelprodukt\.ru\//.test(imageSitemap.text)) {
  errors.push("sitemap-images.xml не содержит изображений основного домена");
}

const results = [];
for (const publicUrl of urls) {
  const path = pathFromUrl(publicUrl);
  const { response, text: html } = await getText(path);
  const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "");
  const description = findMeta(html, "description");
  const canonical = findCanonical(html);
  const robotsMeta = findMeta(html, "robots").toLowerCase();
  const types = schemaTypes(html);

  if (response.status !== 200) errors.push(`${path}: HTTP ${response.status}`);
  if (!title) errors.push(`${path}: отсутствует title`);
  if (!description) errors.push(`${path}: отсутствует description`);
  if (!canonical || normalizedCanonical(canonical) !== normalizedCanonical(publicUrl)) {
    errors.push(`${path}: canonical «${canonical || "нет"}» вместо «${publicUrl}»`);
  }
  if (robotsMeta.includes("noindex")) errors.push(`${path}: обнаружен noindex`);
  if (types.has("INVALID_JSON_LD")) errors.push(`${path}: некорректный JSON-LD`);

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

  results.push({ path, title, description });
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
