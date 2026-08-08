import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /internal/personal-data/
Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content&gclid&yclid&_ym_status-check

Host: www.steelprodukt.ru
Sitemap: ${siteConfig.url}/sitemap.xml
Sitemap: ${siteConfig.url}/sitemap-images.xml
`;

  return new Response(robots, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}
