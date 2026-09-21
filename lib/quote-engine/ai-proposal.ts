import type { EngineeringLeadState } from "@/lib/assistant/types";
import {
  materialLabelToId,
  parseDimensionsMm,
  parsePieceCount,
  parseThicknessMm,
} from "@/lib/quote-engine/field-parsing";

/**
 * The AI's side of the pipeline, and the deterministic gate that stands in
 * front of it.
 *
 * The model is useful here for one thing the regex extractor genuinely cannot
 * do: reading a parameter out of wording nobody anticipated ("лист в два
 * миллиметра", "полста штук", "шестьсот на тысячу двести"). It is not trusted
 * with anything else. §21's "не выдумывать" is enforced mechanically rather
 * than asked for politely: every proposed field must carry `quote`, the exact
 * fragment of the customer's own message the value was read from, and a
 * proposal whose quote is not literally present in that message is discarded
 * before it can reach the calculation.
 *
 * So the model can only ever *surface* something the customer actually wrote.
 * It cannot introduce a number, a material or a type that is not there, and
 * it cannot overrule a value the deterministic extractor already read.
 */

export type AiProposedField = {
  /** The value in the same written form `extractLeadState` would have produced. */
  value: string;
  /** The exact fragment of the customer's message this was read from. */
  quote: string;
};

export type AiCassetteTypeProposal = {
  value: "open" | "closed";
  quote: string;
};

export type AiExtractionProposal = {
  material?: AiProposedField;
  thickness?: AiProposedField;
  dimensions?: AiProposedField;
  quantity?: AiProposedField;
  cassetteType?: AiCassetteTypeProposal;
};

export type AiProposalRejection = {
  field: keyof AiExtractionProposal;
  /** `ungrounded`: the quote is not in the message. `unparsable`: the value did not survive the normal parser. */
  reason: "ungrounded" | "unparsable";
};

export type AiMergeOutcome = {
  state: EngineeringLeadState;
  accepted: Array<keyof AiExtractionProposal>;
  rejected: AiProposalRejection[];
};

function normalizeForGrounding(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** A quote counts as grounded only when it literally occurs in what the customer wrote. */
function isGrounded(quote: string, message: string) {
  const needle = normalizeForGrounding(quote);
  if (!needle) return false;
  return normalizeForGrounding(message).includes(needle);
}

/**
 * Each proposed value must survive the very same parser the deterministic
 * path uses, so a value the calculator could not have read anyway never
 * enters the state just because a model produced it.
 */
function isParsable(field: keyof AiExtractionProposal, value: string) {
  switch (field) {
    case "material":
      return materialLabelToId(value) != null;
    case "thickness":
      return parseThicknessMm(value) != null;
    case "dimensions":
      return parseDimensionsMm(value) != null;
    case "quantity":
      return parsePieceCount(value) != null;
    case "cassetteType":
      return value === "open" || value === "closed";
  }
}

/**
 * Fills only the gaps. A field the deterministic extractor already resolved is
 * never touched, so switching the model on can move a conversation forward but
 * can never change an answer the customer already gave in plain terms.
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

  const fields: Array<keyof AiExtractionProposal> = ["material", "thickness", "dimensions", "quantity", "cassetteType"];
  for (const field of fields) {
    const entry = proposal[field];
    if (!entry) continue;
    // Already known from the customer's own plain wording — the model does not get a vote.
    if (next[field] != null) continue;

    if (!isGrounded(entry.quote, customerMessage)) {
      rejected.push({ field, reason: "ungrounded" });
      continue;
    }
    if (!isParsable(field, entry.value)) {
      rejected.push({ field, reason: "unparsable" });
      continue;
    }

    if (field === "cassetteType") {
      next.cassetteType = entry.value as "open" | "closed";
    } else {
      next[field] = entry.value;
    }
    accepted.push(field);
  }

  return { state: next, accepted, rejected };
}

/**
 * Parses what the model returned. Anything malformed is simply no proposal at
 * all — a broken model response must never be able to stop a quote that the
 * deterministic path could still complete on its own.
 */
export function parseAiProposal(raw: string | null | undefined): AiExtractionProposal | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const source = parsed as Record<string, unknown>;
  const proposal: AiExtractionProposal = {};
  const fields: Array<keyof AiExtractionProposal> = ["material", "thickness", "dimensions", "quantity", "cassetteType"];

  for (const field of fields) {
    const entry = source[field];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const { value, quote } = entry as Record<string, unknown>;
    if (typeof value !== "string" || typeof quote !== "string") continue;
    const trimmedValue = value.trim();
    const trimmedQuote = quote.trim();
    if (!trimmedValue || !trimmedQuote) continue;

    if (field === "cassetteType") {
      if (trimmedValue !== "open" && trimmedValue !== "closed") continue;
      proposal.cassetteType = { value: trimmedValue, quote: trimmedQuote };
    } else {
      proposal[field] = { value: trimmedValue, quote: trimmedQuote };
    }
  }

  return Object.keys(proposal).length ? proposal : null;
}
