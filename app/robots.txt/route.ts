import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const robots = `User-agent: *
Allow: /
Disallow: /api/

User-agent: Yandex
Allow: /
Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content&gclid&yclid&_ym_status-check

User-agent: Googlebot
Allow: /

User-agent: bingbot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

Sitemap: ${siteConfig.url}/sitemap.xml
`;

  return new Response(robots, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}
