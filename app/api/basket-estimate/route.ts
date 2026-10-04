import { handleBasketEstimate } from "@/lib/server/instant-quote/basket-estimate-handler";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleBasketEstimate(request);
}
