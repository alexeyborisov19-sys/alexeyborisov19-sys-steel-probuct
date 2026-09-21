import type { EngineeringLeadState } from "@/lib/assistant/types";
import { materialLabelToId, parseDimensionsMm, parsePieceCount, parseThicknessMm } from "@/lib/quote-engine/field-parsing";
import { hasLiteralEvidence, valueMatchesEvidence } from "@/lib/quote-engine/value-evidence";

/** AI proposes parameters; deterministic source and unit checks authorize them. */
export type AiProposedField = { value: string; quote: string };
export type AiCassetteTypeProposal = { value: "open" | "closed"; quote: string };
export type AiExtractionProposal = {
  material?: AiProposedField;
  thickness?: AiProposedField;
  dimensions?: AiProposedField;
  quantity?: AiProposedField;
  cassetteType?: AiCassetteTypeProposal;
};
export type AiProposalRejection = {
  field: keyof AiExtractionProposal;
  reason: "ungrounded" | "unparsable" | "contradicts-evidence";
};
export type AiMergeOutcome = {
  state: EngineeringLeadState;
  accepted: Array<keyof AiExtractionProposal>;
  rejected: AiProposalRejection[];
};
const FIELDS: Array<keyof AiExtractionProposal> = ["material", "thickness", "dimensions", "quantity", "cassetteType"];

function isParsable(field: keyof AiExtractionProposal, value: string): boolean {
  switch (field) {
    case "material": return materialLabelToId(value) != null;
    case "thickness": return parseThicknessMm(value) != null;
    case "dimensions": return parseDimensionsMm(value) != null;
    case "quantity": {
      const count = parsePieceCount(value);
      return count != null && Number.isSafeInteger(count);
    }
    case "cassetteType": return value === "open" || value === "closed";
  }
}

/**
 * Fills gaps only. A present citation is necessary but insufficient: the value
 * must match the number, unit, material or cassette type it actually states.
 * Unsupported wording remains a question, never a model-selected default.
 */
export function mergeAiProposal(
  state: EngineeringLeadState,
  proposal: AiExtractionProposal | null,
  customerMessage: string,
): AiMergeOutcome {
  if (!proposal) return { state, accepted: [], rejected: [] };
  const accepted: Array<keyof AiExtractionProposal> = [];
  const rejected: AiProposalRejection[] = [];
  const next: EngineeringLeadState = { ...state };
  for (const field of FIELDS) {
    const entry = proposal[field];
    if (!entry || next[field] != null) continue;
    if (typeof entry.quote !== "string" || typeof entry.value !== "string"
      || !hasLiteralEvidence(entry.quote, customerMessage)) {
      rejected.push({ field, reason: "ungrounded" }); continue;
    }
    if (!isParsable(field, entry.value)) {
      rejected.push({ field, reason: "unparsable" }); continue;
    }
    if (!valueMatchesEvidence(field, entry.value, entry.quote)) {
      rejected.push({ field, reason: "contradicts-evidence" }); continue;
    }
    if (field === "cassetteType") next.cassetteType = entry.value as "open" | "closed";
    else next[field] = entry.value;
    accepted.push(field);
  }
  return { state: next, accepted, rejected };
}

/** Bounded model JSON; unknown fields are ignored and never reach calculation. */
export function parseAiProposal(raw: string | null | undefined): AiExtractionProposal | null {
  if (!raw || raw.length > 16_000) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const source = parsed as Record<string, unknown>;
  const proposal: AiExtractionProposal = {};
  for (const field of FIELDS) {
    const entry = source[field];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const { value, quote } = entry as Record<string, unknown>;
    if (typeof value !== "string" || typeof quote !== "string" || value.length > 300 || quote.length > 2000) continue;
    const trimmedValue = value.trim(), trimmedQuote = quote.trim();
    if (!trimmedValue || !trimmedQuote) continue;
    if (field === "cassetteType") {
      if (trimmedValue !== "open" && trimmedValue !== "closed") continue;
      proposal.cassetteType = { value: trimmedValue, quote: trimmedQuote };
    } else proposal[field] = { value: trimmedValue, quote: trimmedQuote };
  }
  return Object.keys(proposal).length ? proposal : null;
}
