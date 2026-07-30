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
