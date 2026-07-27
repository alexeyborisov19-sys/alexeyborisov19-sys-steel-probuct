import type { MetadataRoute } from "next";
import { products } from "@/data/products";
import { solutionDetails } from "@/data/solution-details";
import { articles } from "@/data/articles";
import { absoluteUrl } from "@/lib/site";

const releaseDate = new Date("2026-07-20T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    "/", "/company", "/contacts", "/production", "/solutions", "/industries", "/projects", "/products", "/articles",
    "/products/metallokassety", "/products/dobornye-elementy",
    "/legal/privacy", "/legal/personal-data-consent", "/legal/marketing-consent", "/legal/cookies", "/legal/terms", "/legal/requisites",
  ];
  const paths = [
    ...staticPaths,
    ...solutionDetails.map((solution) => `/solutions/${solution.slug}`),
    ...products.map((product) => `/products/${product.slug}`),
    ...articles.map((article) => `/articles/${article.slug}`),
  ];

  return paths.map((path) => ({
    url: absoluteUrl(path),
    lastModified: articles.find((article) => `/articles/${article.slug}` === path)?.modifiedAt ?? releaseDate,
  }));
}
