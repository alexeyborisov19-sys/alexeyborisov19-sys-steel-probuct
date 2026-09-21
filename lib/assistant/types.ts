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
  /**
   * Open- or closed-type facade cassette, when the customer's own words say
   * which. Not part of `EngineeringField`/`requiredSequence` on purpose: the
   * general lead-capture sequence below never asks for it — only the
   * cassette calculator needs it, and it asks in its own words when missing.
   */
  cassetteType?: "open" | "closed";
  /** A previously stated bend must not disappear when a later reply gives only a quantity. */
  quoteRequiresCad?: boolean;
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
