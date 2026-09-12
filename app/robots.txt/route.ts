import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const robots = `# Public website: search engines and AI retrieval systems may crawl it.
# Sensitive/non-public application routes remain excluded in every explicit group.
User-agent: *
Allow: /
Disallow: /api/
Disallow: /internal/
Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content&gclid&yclid&fbclid&msclkid&gad_source&gbraid&wbraid&_openstat&_ym_status-check

# Major web-search crawlers used by search and AI-backed search experiences.
User-agent: Googlebot
User-agent: bingbot
User-agent: YandexBot
Allow: /
Disallow: /api/
Disallow: /internal/

# AI search and user-requested retrieval.
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Claude-SearchBot
User-agent: Claude-User
Allow: /
Disallow: /api/
Disallow: /internal/

# AI model-improvement crawlers/tokens. Public marketing and engineering content is allowed.
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
Allow: /
Disallow: /api/
Disallow: /internal/

Sitemap: ${siteConfig.url}/sitemap.xml
Sitemap: ${siteConfig.url}/sitemap-images.xml
`;

  return new Response(robots, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}
