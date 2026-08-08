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
  ["/vnutri", "/production/lazernaya-rezka-metalla"],
  ["/dimli", "/solutions/engineering"],
  ["/rehotka", "/solutions/engineering"],
  ["/korzina", "/solutions/climate"],
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
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
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
    "/vnutri",
    "/dimli",
    "/rehotka",
    "/korzina",
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
