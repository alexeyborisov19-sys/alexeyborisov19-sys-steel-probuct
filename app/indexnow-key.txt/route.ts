import { indexNowKey } from "@/lib/indexnow";

export const dynamic = "force-static";

export function GET() {
  return new Response(indexNowKey, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
