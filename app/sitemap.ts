import type { MetadataRoute } from "next";
import { products } from "@/data/products";
import { solutionDetails } from "@/data/solution-details";
import { articles } from "@/data/articles";
import { getIndustrySolutions } from "@/lib/industry-solutions";
import { absoluteUrl } from "@/lib/site";

const releaseDate = new Date("2026-07-20T00:00:00.000Z");
const metalworkingCalendarPath = "/articles/vystavki-metalloobrabotka-kitay-2026";
const facadeCalendarPath = "/articles/vystavki-fasady-arhitektura-2026";
const exhibitionCalendarsModifiedAt = new Date("2026-07-28T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    "/", "/company", "/contacts", "/production", "/solutions", "/industries", "/projects", "/products", "/articles", "/articles/china-tech", "/articles/vystavki-metalloobrabotka-kitay-2026", "/articles/vystavki-fasady-arhitektura-2026", "/calculator-metallokassety",
    "/products/metallokassety", "/products/dobornye-elementy",
    "/legal/privacy", "/legal/personal-data-consent", "/legal/marketing-consent", "/legal/cookies", "/legal/services", "/legal/terms", "/legal/requisites",
  ];
  const paths = [
    ...staticPaths,
    ...solutionDetails.map((solution) => `/solutions/${solution.slug}`),
    ...getIndustrySolutions().map((industry) => `/industries/${industry.slug}`),
    ...products.map((product) => `/products/${product.slug}`),
    ...articles.map((article) => `/articles/${article.slug}`),
  ];

  return [...new Set(paths)].map((path) => {
    const isJournal = path === "/articles" || path.startsWith("/articles/");
    const isExhibitionCalendar = path === facadeCalendarPath || path === metalworkingCalendarPath;
    const isCalculator = path === "/calculator-metallokassety";
    const currentArticle = articles.find((article) => `/articles/${article.slug}` === path);
    const isNews = currentArticle?.direction === "news";

    return {
      url: absoluteUrl(path),
      lastModified: isExhibitionCalendar
        ? exhibitionCalendarsModifiedAt
        : currentArticle?.modifiedAt ?? releaseDate,
      changeFrequency: path === "/articles" || isNews ? "daily" : isExhibitionCalendar ? "monthly" : isJournal ? "weekly" : isCalculator ? "weekly" : "monthly",
      priority: path === "/" ? 1 : path === "/articles" ? 0.9 : isExhibitionCalendar || isCalculator ? 0.9 : isNews ? 0.85 : 0.7,
    };
  });
}
