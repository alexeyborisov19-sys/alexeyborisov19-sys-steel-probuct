import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/site";

export function GET() {
  return NextResponse.redirect(absoluteUrl("/solutions/engineering"), 301);
}
