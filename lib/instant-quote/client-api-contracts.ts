import type { ClientCadPreview } from "@/lib/instant-quote/client-cad-preview-types";
import type { ClientProjectCalculationView } from "@/lib/instant-quote/client-calculation-view";

export type CalculationApiResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  calculation?: ClientProjectCalculationView;
};

export type CadAnalysisApiResponse = {
  ok?: boolean;
  error?: string;
  preview?: ClientCadPreview;
};

/**
 * The browser trusts neither endpoint's shape on faith. These guards are the
 * boundary check between a JSON response and the state the configurator
 * renders: a payload that does not carry the expected discriminator is
 * rejected rather than partially applied.
 */
export function isClientCalculationView(value: unknown): value is ClientProjectCalculationView {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ClientProjectCalculationView>;
  return candidate.kind === "client-calculation" && Array.isArray(candidate.parts) && candidate.paymentEnabled === false
    && candidate.parts.every(part => {
      if (!part || typeof part !== "object" || !part.price || typeof part.price !== "object") return false;
      if (part.price.status === "not-published") return part.price.totalRub == null;
      return ((part.price.status === "approved" && part.status === "ready") || (part.price.status === "estimate" && part.status === "needs-review"))
        && typeof part.price.totalRub === "number" && Number.isFinite(part.price.totalRub) && part.price.totalRub > 0;
    });
}

export function isClientCadPreview(value: unknown): value is ClientCadPreview {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ClientCadPreview>;
  return candidate.kind === "client-cad-preview"
    && candidate.units === "mm"
    && (candidate.status === "recognized" || candidate.status === "needs-review")
    && Boolean(candidate.cad && typeof candidate.cad === "object")
    && Array.isArray(candidate.meshes);
}
