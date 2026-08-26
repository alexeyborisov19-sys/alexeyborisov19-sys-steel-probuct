import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/site";

const legacyRedirects = new Map([
  ["/address", "/contacts"],
  ["/control", "/production"],
  ["/forma-v-bloke", "/contacts#contact-form"],
  ["/foto-oborudovaniya", "/production"],
  ["/galery", "/projects"],
  ["/opisanieprodukcii", "/products"],
  ["/vozmozhnosti", "/production"],
  ["/zapros-specialistu", "/contacts#contact-form"],
  ["/articles/ezhednevnaya-svodka-rossiya-politika-promyshlennost-28-07-2026", "/articles"],
  ["/articles/ezhednevnaya-svodka-metalloobrabotka-proizvodstvo-28-07-2026", "/articles"],
  ["/krovla", "/products"],
  ["/lomedii", "/products"],
  ["/otdekrf", "/products"],
  ["/dekorattivnie", "/products"],
  ["/dimli", "/solutions/engineering"],
  ["/korzina", "/solutions/climate"],
  ["/kronhtein", "/solutions/engineering"],
  ["/rehotka", "/solutions/engineering"],
  ["/vnutri", "/production/lazernaya-rezka-metalla"],
]);

export function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/internal/personal-data"
    || request.nextUrl.pathname.startsWith("/internal/personal-data/")
    || request.nextUrl.pathname === "/api/internal/personal-data"
    || request.nextUrl.pathname.startsWith("/api/internal/personal-data/")
  ) {
    if (process.env.PD_ADMIN_ENABLED !== "true") {
      return new NextResponse("Not Found", {
        status: 404,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      });
    }
    if (
      process.env.NODE_ENV === "production"
      && (
        request.headers.get("x-forwarded-proto")?.toLowerCase() !== "https"
        || (request.headers.get("x-forwarded-host") || request.headers.get("host"))?.toLowerCase() !== "www.steelprodukt.ru"
      )
    ) {
      return new NextResponse("Not Found", {
        status: 404,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      });
    }
    const nonceBytes = new Uint8Array(18);
    crypto.getRandomValues(nonceBytes);
    const nonce = btoa(String.fromCharCode(...nonceBytes));
    const internalCsp = [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src 'none'",
      "media-src 'none'",
    ].join("; ");
    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.set("x-nonce", nonce);
    forwardedHeaders.set("Content-Security-Policy", internalCsp);
    const response = NextResponse.next({ request: { headers: forwardedHeaders } });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Content-Security-Policy", internalCsp);
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  const destination = legacyRedirects.get(request.nextUrl.pathname);

  if (destination) {
    return NextResponse.redirect(absoluteUrl(destination), 301);
  }

  return new NextResponse(
    "Эта страница относилась к прежней версии сайта и окончательно удалена.",
    {
      status: 410,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

export const config = {
  matcher: [
    "/address",
    "/control",
    "/forma-v-bloke",
    "/foto-oborudovaniya",
    "/foto-oborudovaniya/image/:path*",
    "/galery",
    "/galery/image/:path*",
    "/opisanieprodukcii",
    "/vozmozhnosti",
    "/zapros-specialistu",
    "/articles/ezhednevnaya-svodka-rossiya-politika-promyshlennost-28-07-2026",
    "/articles/ezhednevnaya-svodka-metalloobrabotka-proizvodstvo-28-07-2026",
    "/krovla",
    "/lomedii",
    "/otdekrf",
    "/dekorattivnie",
    "/dimli",
    "/korzina",
    "/kronhtein",
    "/rehotka",
    "/vnutri",
    "/cast-iron/:path*",
    "/chugunnoe-lityo",
    "/chugunnoe-lityo-foto",
    "/hudlit/:path*",
    "/hudozhestvennoe-lityo",
    "/lityo-stali",
    "/lityo-stali-foto",
    "/postavka-krestovin",
    "/news/news_post/:path*",
    "/my/s3/feedback/report.php",
    "/internal/personal-data/:path*",
    "/api/internal/personal-data/:path*",
  ],
};
