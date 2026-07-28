import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  async redirects() {
    return [
      {
        source: "/articles/ezhednevnaya-svodka-rossiya-politika-promyshlennost-28-07-2026",
        destination: "/articles/ezhednevnaya-svodka-metalloobrabotka-proizvodstvo-28-07-2026",
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
