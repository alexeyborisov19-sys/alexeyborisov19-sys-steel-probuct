import type { Metadata } from "next";
import { absoluteUrl, canonicalPath, siteConfig } from "./site";

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: readonly string[];
  openGraphType?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

// Next merges metadata per key: a page's own `alternates` replaces the layout's whole
// object rather than extending it. The layout declares the feed for autodiscovery, so
// every page built through this factory silently dropped that link. Declaring it here,
// from the one place both sides read, puts it back on all of them.
// Typed against Next's own shape rather than inferred: `as const` would make the array
// readonly, which the metadata type does not accept, and the annotation catches that here
// instead of at every call site.
export const feedAlternateTypes: NonNullable<NonNullable<Metadata["alternates"]>["types"]> = {
  "application/rss+xml": [{ url: "/feed.xml", title: `Инженерный журнал «${siteConfig.name}»` }],
};

function socialImagePath(image: string) {
  // Project/article content can legitimately use an attributed external photo,
  // but Open Graph images should stay on our own domain. This keeps social
  // previews stable and prevents SEO audits from depending on third-party CDNs.
  return /^https?:\/\//i.test(image) ? siteConfig.defaultOgImage : image;
}

export function createPageMetadata({
  title,
  description,
  path,
  image = siteConfig.defaultOgImage,
  keywords = [],
  openGraphType = "website",
  publishedTime,
  modifiedTime,
}: PageMetadataInput): Metadata {
  const canonical = canonicalPath(path);
  const socialImage = socialImagePath(image);
  const openGraph: NonNullable<Metadata["openGraph"]> = {
    type: openGraphType,
    locale: siteConfig.locale,
    url: absoluteUrl(canonical),
    siteName: siteConfig.name,
    title,
    description,
    // No width/height on purpose. Pages pass their own image and the default master is
    // 1672x941, so the 1200x630 that used to stand here was wrong on every page — wrong
    // pixels and wrong ratio. A platform that trusts those numbers lays the card out for
    // a shape the file does not have; no numbers at all makes it measure the real file.
    images: [{ url: absoluteUrl(socialImage), alt: title }],
    ...(openGraphType === "article"
      ? {
          publishedTime,
          modifiedTime,
          authors: [siteConfig.name],
        }
      : {}),
  };

  return {
    title,
    description,
    keywords: [...keywords],
    alternates: { canonical, types: feedAlternateTypes },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl(socialImage)],
    },
  };
}
