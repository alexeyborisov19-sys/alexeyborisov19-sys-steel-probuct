import type { MetadataRoute } from "next";
import { products } from "@/data/products";
import { solutionDetails } from "@/data/solution-details";
import { absoluteUrl } from "@/lib/site";

const releaseDate = new Date("2026-07-20T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    "/", "/company", "/contacts", "/production", "/solutions", "/industries", "/projects", "/products",
    "/products/metallokassety", "/products/dobornye-elementy",
  ];
  const paths = [
    ...staticPaths,
    ...solutionDetails.map((solution) => `/solutions/${solution.slug}`),
    ...products.map((product) => `/products/${product.slug}`),
  ];

  return paths.map((path) => ({
    url: absoluteUrl(path),
    lastModified: releaseDate,
  }));
}
