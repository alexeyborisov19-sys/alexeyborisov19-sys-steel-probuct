import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://mc.yandex.ru",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://mc.yandex.ru https://mc.yandex.com",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self' https://mc.yandex.ru https://mc.yandex.com",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  async redirects() {
    return [
      // HTTP → HTTPS
      {
        source: "/:path*",
        has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
        destination: "https://www.steelprodukt.ru/:path*",
        permanent: true,
      },
      // non-www → www
      {
        source: "/:path*",
        has: [{ type: "host", value: "steelprodukt.ru" }],
        destination: "https://www.steelprodukt.ru/:path*",
        permanent: true,
      },
      // Legacy article redirects
      {
        source: "/articles/ezhednevnaya-svodka-rossiya-politika-promyshlennost-28-07-2026",
        destination: "/articles",
        permanent: true,
      },
      {
        source: "/articles/ezhednevnaya-svodka-metalloobrabotka-proizvodstvo-28-07-2026",
        destination: "/articles",
        permanent: true,
      },
      // Old 404 pages from Yandex Webmaster (301 permanent)
      {
        source: "/krovla",
        destination: "/products",
        permanent: true,
      },
      {
        source: "/lomedii",
        destination: "/products",
        permanent: true,
      },
      {
        source: "/otdekrf",
        destination: "/products",
        permanent: true,
      },
      {
        source: "/dekorattivnie",
        destination: "/products",
        permanent: true,
      },
      {
        source: "/dimli",
        destination: "/products",
        permanent: true,
      },
      {
        source: "/korzina",
        destination: "/solutions/climate",
        permanent: true,
      },
      {
        source: "/kronhtein",
        destination: "/solutions/engineering",
        permanent: true,
      },
      {
        source: "/rehotka",
        destination: "/solutions/engineering",
        permanent: true,
      },
      {
        source: "/vnutri",
        destination: "/solutions",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/internal/personal-data/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/api/internal/personal-data/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/images/web/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
