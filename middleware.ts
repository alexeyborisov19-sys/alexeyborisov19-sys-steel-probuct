import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const legacyRedirects = new Map([
  ["/address", "/contacts"],
  ["/control", "/production"],
  ["/forma-v-bloke", "/contacts#contact-form"],
  ["/foto-oborudovaniya", "/production"],
  ["/galery", "/projects"],
  ["/opisanieprodukcii", "/products"],
  ["/vozmozhnosti", "/production"],
  ["/zapros-specialistu", "/contacts#contact-form"],
]);

export function middleware(request: NextRequest) {
  const destination = legacyRedirects.get(request.nextUrl.pathname);

  if (destination) {
    return NextResponse.redirect(new URL(destination, request.url), 301);
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
  ],
};
