import { createAssistantQuoteHandler } from "@/lib/server/quote-engine/assistant-quote-handler";

export const runtime = "nodejs";

export const POST = createAssistantQuoteHandler();
