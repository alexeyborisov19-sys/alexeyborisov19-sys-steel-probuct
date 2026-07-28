import { articles } from "@/data/articles";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const dynamic = "force-static";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET() {
  const items = [...articles]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((article) => {
      const url = absoluteUrl(`/articles/${article.slug}`);
      return `<item>
  <title>${escapeXml(article.title)}</title>
  <link>${url}</link>
  <guid isPermaLink="true">${url}</guid>
  <description>${escapeXml(article.lead)}</description>
  <category>${escapeXml(article.category)}</category>
  <pubDate>${new Date(`${article.publishedAt}T09:00:00+03:00`).toUTCString()}</pubDate>
</item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml("Инженерный журнал «Сталь Продукт»")}</title>
  <link>${absoluteUrl("/articles")}</link>
  <description>${escapeXml("Новости металлообработки, фасадные инновации, выставки и инженерная практика.")}</description>
  <language>ru</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <managingEditor>${siteConfig.email} (${escapeXml(siteConfig.name)})</managingEditor>
${items}
</channel>
</rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
