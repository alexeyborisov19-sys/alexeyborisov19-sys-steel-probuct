import type { MetadataRoute } from "next";
import { products } from "@/data/products";
import { solutionDetails } from "@/data/solution-details";
import { articles } from "@/data/articles";
import { productionServices } from "@/data/production-services";
import { getIndustrySolutions } from "@/lib/industry-solutions";
import { absoluteUrl } from "@/lib/site";

const legalUpdatedAt = new Date("2026-07-30T00:00:00.000Z");
const metalworkingCalendarPath = "/articles/vystavki-metalloobrabotka-kitay-2026";
const facadeCalendarPath = "/articles/vystavki-fasady-arhitektura-2026";
const retiredPaths = new Set(["/vnutri"]);
const exhibitionCalendarsModifiedAt = new Date("2026-07-29T00:00:00.000Z");
const staticModifiedAt: Record<string, Date> = {
  "/": new Date("2026-08-02T00:00:00.000Z"),
  "/company": new Date("2026-08-02T00:00:00.000Z"),
  "/contacts": new Date("2026-08-02T00:00:00.000Z"),
  "/production": new Date("2026-08-02T00:00:00.000Z"),
  "/solutions": new Date("2026-08-02T00:00:00.000Z"),
  "/industries": new Date("2026-08-02T00:00:00.000Z"),
  "/projects": new Date("2026-07-20T00:00:00.000Z"),
  "/products": new Date("2026-08-02T00:00:00.000Z"),
  "/articles": new Date("2026-07-29T00:00:00.000Z"),
  "/articles/china-tech": new Date("2026-07-27T00:00:00.000Z"),
  "/calculator-metallokassety": new Date("2026-07-29T00:00:00.000Z"),
  "/products/metallokassety": new Date("2026-08-02T00:00:00.000Z"),
  "/products/dobornye-elementy": new Date("2026-08-02T00:00:00.000Z"),
};

function contentModifiedAt(path: string) {
  if (path.startsWith("/legal/")) return legalUpdatedAt;
  if (path.startsWith("/production/")) return new Date("2026-08-02T00:00:00.000Z");
  if (path.startsWith("/solutions/")) return new Date("2026-08-02T00:00:00.000Z");
  if (path.startsWith("/industries/")) return new Date("2026-07-29T00:00:00.000Z");
  if (path.startsWith("/products/")) return new Date("2026-07-27T00:00:00.000Z");
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
