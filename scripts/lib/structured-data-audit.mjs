// A bounded server-HTML check, not a replacement for Google's Rich Results Test.
// Product commerce fields must never be invented to satisfy snippet eligibility.
const nonemptyText = (value) => typeof value === "string" && value.trim().length > 0;
const hasValue = (value) => value !== undefined && value !== null;
const meaningfulObject = (value) => value && typeof value === "object"
  && !Array.isArray(value) && Object.keys(value).length > 0;

function absoluteHttpUrl(value) {
  if (!nonemptyText(value)) return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

function isoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) return false;
  const datePart = value.slice(0, 10);
  const parsed = new Date(`${datePart}T00:00:00Z`);
  return Number.isFinite(Date.parse(value)) && Number.isFinite(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === datePart;
}

export function inspectStructuredData(html) {
  const types = new Set();
  const errors = [];
  const eligibilityLimitations = [];
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const nodeTypes = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    nodeTypes.filter((type) => typeof type === "string").forEach((type) => types.add(type));
    const name = nonemptyText(value.name) ? value.name : String(value["@id"] ?? "без названия");
    if (nodeTypes.includes("Product")) {
      if (!nonemptyText(value.name)) errors.push({ code: "PRODUCT_NAME_MISSING", name, message: "Product: отсутствует name" });
      const commerce = ["offers", "review", "aggregateRating"];
      if (!commerce.some((field) => hasValue(value[field]))) {
        eligibilityLimitations.push({ code: "PRODUCT_COMMERCE_MISSING", name, message: "Product: нет offers/review/aggregateRating; недоступен product rich snippet, это не запрет обычной индексации" });
      }
      for (const field of commerce) {
        if (!hasValue(value[field])) continue;
        const entries = Array.isArray(value[field]) ? value[field] : [value[field]];
        if (!entries.length || !entries.every(meaningfulObject)) {
          errors.push({ code: "PRODUCT_COMMERCE_EMPTY", name, message: `Product: ${field} содержит пустые или некорректные данные` });
        }
      }
    }
    if (nodeTypes.includes("VideoObject")) {
      if (!nonemptyText(value.name)) errors.push({ code: "VIDEO_NAME_MISSING", name, message: "VideoObject: отсутствует name" });
      const thumbnails = Array.isArray(value.thumbnailUrl) ? value.thumbnailUrl : [value.thumbnailUrl];
      if (!thumbnails.length || !thumbnails.every(absoluteHttpUrl)) errors.push({ code: "VIDEO_THUMBNAIL_INVALID", name, message: "VideoObject: отсутствует или некорректен thumbnailUrl" });
      if (!isoDate(value.uploadDate)) errors.push({ code: "VIDEO_UPLOAD_DATE_INVALID", name, message: "VideoObject: отсутствует или некорректен uploadDate" });
    }
    Object.values(value).forEach(visit);
  }
  for (const block of html.matchAll(/<script\b[^>]*\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(block[1])); } catch {
      errors.push({ code: "INVALID_JSON_LD", name: "JSON-LD", message: "Некорректный JSON-LD" });
    }
  }
  return { types: [...types], errors, eligibilityLimitations, validationScope: "bounded-server-jsonld-check-not-google-eligibility" };
}
