import type { SessionQuoteSnapshot } from "@/lib/server/quote-engine/session-snapshot";

export type EngineeringField =
  | "productType"
  | "purpose"
  | "material"
  | "thickness"
  | "dimensions"
  | "quantity"
  | "coating"
  | "ral"
  | "drawingAvailable"
  | "fileTypes"
  | "deadline"
  | "deliveryRegion";

export type EngineeringLeadState = {
  productType?: string;
  purpose?: string;
  material?: string;
  thickness?: string;
  dimensions?: string;
  quantity?: string;
  coating?: string;
  ral?: string;
  drawingAvailable?: boolean;
  fileTypes?: string[];
  deadline?: string;
  deliveryRegion?: string;
  cassetteType?: "open" | "closed";
  quoteRequiresCad?: boolean;
  /** Extra operations/geometry cannot disappear after the customer answers a quantity question. */
  quoteRequiredScope?: string[];
  unknownFields: EngineeringField[];
  missingFields: EngineeringField[];
  readiness: "new" | "clarifying" | "ready_for_lead";
};

export type ServerConversationMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AssistantSession = {
  id: string;
  ownerKey: string;
  state: EngineeringLeadState;
  history: ServerConversationMessage[];
  lastAskedField?: EngineeringField;
  quoteCalculator?: "auto" | "metal-parts" | "metal-cassettes";
  /** Internal only. Written to the protected lead record after explicit consent. */
  quoteSnapshot?: SessionQuoteSnapshot;
  createdAt: number;
  updatedAt: number;
};

export type StructuredAssistantResult = {
  answer: string;
  extractedFields: Partial<Record<EngineeringField, string | boolean | string[]>>;
  missingFields: EngineeringField[];
  nextQuestion: string;
  readyForLead: boolean;
  safetyFlags: string[];
};
