import { randomUUID } from "node:crypto";
import type { EngineeringLeadState } from "@/lib/assistant/types";
import type { QuoteEngineInternalRecord } from "@/lib/server/quote-engine/execute";
import type { QuoteEngineTurnResult } from "@/lib/server/quote-engine/handle-request";

export type SessionQuoteSnapshot = {
  version: "session-quote-snapshot-v1";
  calculationId: string;
  createdAt: string;
  status: "priced" | "blocked";
  parameters: EngineeringLeadState;
  clientMessage: string;
  record: QuoteEngineInternalRecord | null;
};

/** In-memory until the existing consented lead write; never part of the public reply. */
export function captureQuoteSnapshot(result: Exclude<QuoteEngineTurnResult, { kind: "question" }>): SessionQuoteSnapshot {
  const snapshot: SessionQuoteSnapshot = {
    version: "session-quote-snapshot-v1", calculationId: randomUUID(), createdAt: new Date().toISOString(),
    status: result.kind, parameters: result.state, clientMessage: result.clientMessage, record: result.record,
  };
  const json = JSON.stringify(snapshot);
  if (Buffer.byteLength(json, "utf8") > 524_288) throw new Error("Quote audit exceeds the internal snapshot limit");
  return JSON.parse(json) as SessionQuoteSnapshot;
}
