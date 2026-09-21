import type { AssistantSession, EngineeringLeadState } from "@/lib/assistant/types";
import type { QuoteEngineInternalRecord } from "@/lib/server/quote-engine/execute";
import type { QuoteEngineTurnResult } from "@/lib/server/quote-engine/handle-request";

/** Lives only in the owner-bound server session and the consented private lead. */
export type SessionQuoteSnapshot = {
  classification: "server-verified-calculation";
  version: "session-quote-v1";
  capturedAt: string;
  status: "priced" | "blocked";
  state: EngineeringLeadState;
  clientMessage: string;
  record: QuoteEngineInternalRecord | null;
};

export function captureSessionQuote(result: QuoteEngineTurnResult): SessionQuoteSnapshot | undefined {
  if (result.kind === "question") return undefined;
  return structuredClone({
    classification: "server-verified-calculation", version: "session-quote-v1",
    capturedAt: new Date().toISOString(), status: result.kind,
    state: result.state, clientMessage: result.clientMessage, record: result.record,
  });
}

/** Called only after consent and owner-bound session lookup; no form field is used. */
export function quoteSnapshotForLead(session: AssistantSession | undefined): SessionQuoteSnapshot | null {
  const snapshot = session?.quoteSnapshot;
  if (!session || !snapshot || JSON.stringify(snapshot.state) !== JSON.stringify(session.state)) return null;
  return structuredClone(snapshot);
}
