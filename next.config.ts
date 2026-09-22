import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://mc.yandex.ru",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://mc.yandex.ru https://mc.yandex.com",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self' https://mc.yandex.ru https://mc.yandex.com",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
  // Keep whitespace on both sides of the directive separator. The CSP semantics
  // are unchanged, but static URL scanners do not mistake the semicolon for part
  // of a hostname such as `mc.yandex.ru;` or `mc.yandex.com;`.
].join(" ; ");

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
    ? [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
      ]
    : []),
];

const stablePublicAssetCache = "public, max-age=86400, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  experimental: { middlewareClientMaxBodySize: "101mb" },
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keep the native WASM package external on the Node.js server. Next's server
  // bundler can otherwise move the JavaScript wrapper into .next while the
  // occt-wasm.wasm binary remains beside the installed package in node_modules,
  // which breaks OcctKernel.init() at runtime. Production installs dependencies
  // on the Beget host before starting Next, so the package and its WASM asset are
  // available together at their original filesystem location.
  serverExternalPackages: ["occt-wasm"],
  images: {
    // Project photography is published from this site only. Do not whitelist
    // remote image hosts: an external file can vanish or change without notice,
    // and local publication requires a documented right in
    // LEGAL_MEDIA_RIGHTS_REGISTER.md.
    remotePatterns: [],
    // No master in public/ is wider than 1920px, so the 2048 and 3840 variants only
    // burn optimizer CPU and disk on the single worker.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 190, 256, 384],
    // Filenames under public/ are stable and unhashed, so keeping optimized copies for
    // a day is safer than regenerating them every minute.
    minimumCacheTTL: 86400,
    // nginx varies its page-cache key by the browser's Accept header, so optimized
    // AVIF and WebP responses cannot cross-contaminate clients with different support.
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return [
      // Transport/canonical host redirects stay in Next config. Legacy content
      // redirects live in middleware so they can emit a tested direct HTTP 301.
      {
        source: "/:path*",
        has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
        destination: "https://www.steelprodukt.ru/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "steelprodukt.ru" }],
        destination: "https://www.steelprodukt.ru/:path*",
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
      // Public image and video names are stable, not content-hashed. Keep them
      // cacheable, but revalidate so replacing a file under the same URL reaches
      // returning visitors instead of pinning stale media indefinitely.
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: stablePublicAssetCache }],
      },
      {
        source: "/video/:path*",
        headers: [{ key: "Cache-Control", value: stablePublicAssetCache }],
      },
    ];
  },
};

export default nextConfig;
