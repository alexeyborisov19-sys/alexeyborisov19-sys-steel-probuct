import type { MetadataRoute } from "next";
import { products } from "@/data/products";
import { solutionDetails } from "@/data/solution-details";
import { articles } from "@/data/articles";
import { absoluteUrl } from "@/lib/site";

const releaseDate = new Date("2026-07-20T00:00:00.000Z");
const metalworkingCalendarPath = "/articles/vystavki-metalloobrabotka-kitay-2026";
const facadeCalendarPath = "/articles/vystavki-fasady-arhitektura-2026";
const exhibitionCalendarsModifiedAt = new Date("2026-07-28T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    "/", "/company", "/contacts", "/production", "/solutions", "/industries", "/projects", "/products", "/articles", "/articles/china-tech", "/articles/vystavki-metalloobrabotka-kitay-2026", "/articles/vystavki-fasady-arhitektura-2026",
    "/products/metallokassety", "/products/dobornye-elementy",
    "/legal/privacy", "/legal/personal-data-consent", "/legal/marketing-consent", "/legal/cookies", "/legal/services", "/legal/terms", "/legal/requisites",
  ];
  const paths = [
    ...staticPaths,
    ...solutionDetails.map((solution) => `/solutions/${solution.slug}`),
    ...products.map((product) => `/products/${product.slug}`),
    ...articles.map((article) => `/articles/${article.slug}`),
  ];

  return [...new Set(paths)].map((path) => {
    const isJournal = path === "/articles" || path.startsWith("/articles/");
    const isExhibitionCalendar = path === facadeCalendarPath || path === metalworkingCalendarPath;

    return {
      url: absoluteUrl(path),
      lastModified: isExhibitionCalendar
        ? exhibitionCalendarsModifiedAt
        : articles.find((article) => `/articles/${article.slug}` === path)?.modifiedAt ?? releaseDate,
      changeFrequency: isExhibitionCalendar ? "monthly" : isJournal ? "weekly" : "monthly",
      priority: path === "/" ? 1 : isExhibitionCalendar ? 0.9 : path === "/articles" ? 0.8 : 0.7,
    };
  });
}
