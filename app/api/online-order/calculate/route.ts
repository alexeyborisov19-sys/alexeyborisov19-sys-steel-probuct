import { createOnlineCalculationHandler } from "@/lib/server/instant-quote/calculation-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createOnlineCalculationHandler();
