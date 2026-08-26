import type { MetadataRoute } from "next";
import { commercialProductLandings } from "@/data/commercial-product-landings";
import { products } from "@/data/products";
import { solutionDetails } from "@/data/solution-details";
import { solutionSeoBySlug } from "@/data/solution-seo";
import { articles } from "@/data/articles";
import { productionServices } from "@/data/production-services";
import { getIndustrySolutions } from "@/lib/industry-solutions";
import { legalDocumentVersions } from "@/lib/legal";
import { absoluteUrl } from "@/lib/site";

const legalFallbackUpdatedAt = new Date("2026-07-30T00:00:00.000Z");
const legalModifiedAt: Record<string, Date> = {
  "/legal/privacy": new Date(`${legalDocumentVersions.privacy}T00:00:00.000Z`),
  "/legal/personal-data-consent": new Date(`${legalDocumentVersions.personalDataConsent}T00:00:00.000Z`),
  "/legal/marketing-consent": new Date(`${legalDocumentVersions.marketingConsent}T00:00:00.000Z`),
  "/legal/cookies": new Date(`${legalDocumentVersions.cookies}T00:00:00.000Z`),
  "/legal/services": new Date(`${legalDocumentVersions.services}T00:00:00.000Z`),
  "/legal/terms": new Date(`${legalDocumentVersions.terms}T00:00:00.000Z`),
};
const productionServicesModifiedAt = new Date("2026-08-25T20:45:11.000Z");
const solutionDetailsModifiedAt = new Date("2026-08-25T14:09:18.000Z");
const industryPagesModifiedAt = new Date("2026-08-25T15:10:21.000Z");
const productPagesModifiedAt = new Date("2026-08-25T15:03:23.000Z");
const metalworkingCalendarPath = "/articles/vystavki-metalloobrabotka-kitay-2026";
const facadeCalendarPath = "/articles/vystavki-fasady-arhitektura-2026";
const retiredPaths = new Set(["/vnutri", "/dimli", "/rehotka", "/korzina"]);
const exhibitionCalendarsModifiedAt = new Date("2026-07-29T00:00:00.000Z");
const staticModifiedAt: Record<string, Date> = {
  "/": new Date("2026-08-26T00:00:00.000Z"),
  "/company": new Date("2026-08-25T15:10:21.000Z"),
  "/contacts": new Date("2026-08-25T17:32:36.000Z"),
  "/production": new Date("2026-08-25T21:24:08.000Z"),
  "/solutions": new Date("2026-08-20T00:00:00.000Z"),
  "/industries": new Date("2026-08-20T14:44:10.000Z"),
  "/projects": new Date("2026-08-25T12:06:42.000Z"),
  "/products": new Date("2026-08-25T15:45:53.000Z"),
  "/articles": new Date("2026-08-20T00:00:00.000Z"),
  "/articles/china-tech": new Date("2026-07-27T00:00:00.000Z"),
  "/calculator-metallokassety": new Date("2026-08-25T13:18:54.000Z"),
  "/products/metallokassety": productPagesModifiedAt,
  "/products/dobornye-elementy": new Date("2026-08-19T19:17:15.000Z"),
  "/products/korziny-dlya-konditsionerov": new Date("2026-08-25T00:00:00.000Z"),
  "/products/ventilyacionnye-reshetki": new Date("2026-08-25T00:00:00.000Z"),
  "/products/metallicheskie-korpusa": new Date("2026-08-25T00:00:00.000Z"),
  "/products/zakladnye-detali": new Date("2026-08-25T00:00:00.000Z"),
};

function contentModifiedAt(path: string) {
  if (path.startsWith("/legal/")) return legalModifiedAt[path] ?? legalFallbackUpdatedAt;
  if (path.startsWith("/production/")) return productionServicesModifiedAt;
  if (path.startsWith("/solutions/")) {
    const solution = solutionDetails.find((item) => `/solutions/${item.slug}` === path);
    const modifiedAt = solution ? solutionSeoBySlug[solution.slug]?.modifiedAt : undefined;
    if (!modifiedAt) return solutionDetailsModifiedAt;
    const seoModifiedAt = new Date(`${modifiedAt}T00:00:00.000Z`);
    return seoModifiedAt > solutionDetailsModifiedAt ? seoModifiedAt : solutionDetailsModifiedAt;
  }
  if (path.startsWith("/industries/")) return industryPagesModifiedAt;
  if (path.startsWith("/products/")) return staticModifiedAt[path] ?? productPagesModifiedAt;
  return staticModifiedAt[path] ?? new Date("2026-07-20T00:00:00.000Z");
}

const commercialHubs = new Set([
  "/production",
  "/solutions",
  "/industries",
  "/products",
  "/products/metallokassety",
  "/products/dobornye-elementy",
]);

function sitemapPriority(path: string, isExhibitionCalendar: boolean) {
  if (path === "/") return 1;
  if (commercialHubs.has(path)) return 0.9;
  if (path === "/calculator-metallokassety" || path === "/contacts") return 0.9;
  if (path.startsWith("/production/") || path.startsWith("/solutions/") || path.startsWith("/industries/") || path.startsWith("/products/")) return 0.85;
  if (path === "/articles") return 0.85;
  if (isExhibitionCalendar || path === "/articles/china-tech") return 0.8;
  if (path.startsWith("/articles/")) return 0.8;
  if (path.startsWith("/legal/")) return 0.2;
  return 0.75;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    "/", "/company", "/contacts", "/production", "/solutions", "/industries", "/projects", "/products", "/articles", "/articles/china-tech", "/articles/vystavki-metalloobrabotka-kitay-2026", "/articles/vystavki-fasady-arhitektura-2026", "/calculator-metallokassety",
    "/products/metallokassety", "/products/dobornye-elementy",
    "/legal/privacy", "/legal/personal-data-consent", "/legal/marketing-consent", "/legal/cookies", "/legal/services", "/legal/terms", "/legal/requisites",
  ];
  const paths = [
    ...staticPaths,
    ...productionServices.map((service) => `/production/${service.slug}`),
    ...solutionDetails.map((solution) => `/solutions/${solution.slug}`),
    ...getIndustrySolutions().map((industry) => `/industries/${industry.slug}`),
    ...products.map((product) => `/products/${product.slug}`),
    ...commercialProductLandings.map((landing) => `/products/${landing.slug}`),
    ...articles.map((article) => `/articles/${article.slug}`),
  ];

  return [...new Set(paths)].filter((path) => !retiredPaths.has(path)).map((path) => {
    const isJournal = path === "/articles" || path.startsWith("/articles/");
    const isExhibitionCalendar = path === facadeCalendarPath || path === metalworkingCalendarPath;
    const isCalculator = path === "/calculator-metallokassety";
    const currentArticle = articles.find((article) => `/articles/${article.slug}` === path);
    const isLegal = path.startsWith("/legal/");

    return {
      url: absoluteUrl(path),
      lastModified: isExhibitionCalendar
        ? exhibitionCalendarsModifiedAt
        : currentArticle?.modifiedAt ?? contentModifiedAt(path),
      changeFrequency: path === "/articles"
        ? "weekly"
        : isExhibitionCalendar || isJournal || isCalculator
          ? "weekly"
          : isLegal
            ? "yearly"
            : "monthly",
      priority: sitemapPriority(path, isExhibitionCalendar),
    };
  });
}
