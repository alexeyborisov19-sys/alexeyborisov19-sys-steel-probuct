import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { EngineeringLeadState } from "@/lib/assistant/types";
import type { MetalCassetteReadyInput, MetalPartsReadyInput } from "@/lib/quote-engine/plan";
import { materialLabelToId } from "@/lib/quote-engine/field-parsing";
import { validMarketSpec, type MarketQuoteSpec } from "@/lib/quote-engine/market-floor";

export type ReadyQuotePlan =
  | { calculator: "metal-parts"; input: MetalPartsReadyInput }
  | { calculator: "metal-cassettes"; input: MetalCassetteReadyInput };
export type QuoteMarketContext = {
  status: "loaded" | "not-configured" | "unavailable" | "basis-mismatch";
  target: MarketQuoteSpec | null;
  offers: readonly unknown[];
};
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** The registry describes the existing selling price's actual scope and tax basis. */
export function marketContextFromRegistry(plan: ReadyQuotePlan, state: EngineeringLeadState | undefined, raw: unknown, budgetAreaM2?: number): QuoteMarketContext {
  const unavailable: QuoteMarketContext = { status: "unavailable", target: null, offers: [] };
  const registry = record(raw);
  if (!registry || registry.version !== "verified-market-offers-v1"
    || !Array.isArray(registry.offers) || registry.offers.length > 100) return unavailable;
  const bases = record(registry.priceBasis);
  const budget = budgetAreaM2 !== undefined;
  if (budget && (plan.calculator !== "metal-cassettes" || !Number.isFinite(budgetAreaM2) || budgetAreaM2 <= 0)) return unavailable;
  const basis = bases ? record(bases[budget ? "metal-cassettes-budget" : plan.calculator]) : null;
  if (!basis) return { ...unavailable, status: "basis-mismatch" };
  const target = {
    calculator: plan.calculator,
    product: plan.calculator === "metal-parts" ? "flat-rectangle" : "facade-cassette",
    material: plan.calculator === "metal-parts" ? plan.input.materialId : basis.material,
    thicknessMm: plan.calculator === "metal-parts" ? plan.input.thicknessMm : Number(plan.input.thickness),
    widthMm: plan.calculator === "metal-parts" ? plan.input.widthMm : plan.input.moduleWidthMm,
    heightMm: plan.calculator === "metal-parts" ? plan.input.heightMm : plan.input.moduleHeightMm,
    quantity: plan.input.quantity,
    cassetteType: plan.calculator === "metal-parts" ? null : plan.input.type,
    ...(budget ? { areaBasis: "net-facade", netFacadeAreaM2: budgetAreaM2 } : {}),
    finish: basis.finish, scope: basis.scope, vat: basis.vat, vatRatePct: basis.vatRatePct,
  };
  if (budget && basis.areaBasis !== "net-facade") return { ...unavailable, status: "basis-mismatch" };
  if (!validMarketSpec(target)) return { ...unavailable, status: "basis-mismatch" };
  // The text parts path prices a flat cut with material and already declares
  // included VAT. A registry must not silently relabel it as tax-exclusive.
  if (plan.calculator === "metal-parts" && (target.finish !== "none" || target.vat !== "included"
    || [...target.scope].sort().join(",") !== "laser-cutting,material")) return { ...unavailable, status: "basis-mismatch" };
  const requestedMaterial = materialLabelToId(state?.material);
  if (requestedMaterial && requestedMaterial !== target.material) return { ...unavailable, status: "basis-mismatch" };
  if (state?.coating) {
    if (/без\s+(?:покрытия|окраски|покраски)/iu.test(state.coating) && target.finish !== "none") return { ...unavailable, status: "basis-mismatch" };
    if (/порошк/iu.test(state.coating)) {
      const ral = state.ral?.match(/\d{4}/)?.[0];
      if (!ral || target.finish !== `powder:${ral}`) return { ...unavailable, status: "basis-mismatch" };
    }
  }
  return { status: "loaded", target, offers: registry.offers };
}

/** No browser pathname or search snippet can become a pricing reference. */
export async function loadQuoteMarketContext(
  plan: ReadyQuotePlan, state?: EngineeringLeadState, environment: NodeJS.ProcessEnv = process.env, budgetAreaM2?: number,
): Promise<QuoteMarketContext> {
  const empty = (status: QuoteMarketContext["status"]): QuoteMarketContext => ({ status, target: null, offers: [] });
  const path = environment.STEEL_PRODUCT_MARKET_REFERENCE_FILE?.trim();
  if (!path) return empty("not-configured");
  if (!isAbsolute(path) || !path.endsWith(".json")) return empty("unavailable");
  try {
    const resolved = await realpath(path);
    const fromProject = relative(process.cwd(), resolved);
    const outsideProject = fromProject === ".." || fromProject.startsWith(`..${sep}`);
    if (resolved !== resolve(path) || !outsideProject || isAbsolute(fromProject)) return empty("unavailable");
    const handle = await open(resolved, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const limit = 1_048_576;
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > limit || (stat.mode & 0o007) !== 0) return empty("unavailable");
      const buffer = Buffer.alloc(limit + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > limit) return empty("unavailable");
      return marketContextFromRegistry(plan, state, JSON.parse(buffer.subarray(0, length).toString("utf8")), budgetAreaM2);
    } finally { await handle.close(); }
  } catch { return empty("unavailable"); }
}
