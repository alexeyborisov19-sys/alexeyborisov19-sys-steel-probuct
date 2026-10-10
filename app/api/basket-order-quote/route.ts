import { handleBasketOrderQuote } from "@/lib/server/instant-quote/basket-order-handler";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleBasketOrderQuote(request);
}
