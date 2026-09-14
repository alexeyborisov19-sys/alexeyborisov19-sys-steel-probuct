import type { InstantQuoteProject } from "@/lib/instant-quote/domain";
import { resolveMaterialStockPlan } from "@/lib/instant-quote/blanking";
import type { PartFactualInputs } from "@/lib/instant-quote/project-factual-calculation";

/**
 * Resolves physical manufacturing inputs by provenance.
 *
 * Priority is deliberate:
 * 1. explicit technologist values;
 * 2. server-authoritative CAD evidence;
 * 3. conservative derivation from an explicitly selected number of coating sides.
 *
 * Nothing in this resolver invents a physical parameter. In particular, a DXF
 * without an explicit coating-side choice remains incomplete.
 */
export function resolveEffectiveFactualInputs(
  project: InstantQuoteProject,
  explicitByPartId: Record<string, PartFactualInputs>,
  powderSidesByPartId: Record<string, 1 | 2>,
  authoritativeByPartId: Record<string, PartFactualInputs> = {},
): Record<string, PartFactualInputs> {
  const resolved: Record<string, PartFactualInputs> = {};
  const partIds = new Set([
    ...Object.keys(authoritativeByPartId),
    ...Object.keys(explicitByPartId),
  ]);

  for (const partId of partIds) {
    resolved[partId] = {
      ...(authoritativeByPartId[partId] ?? {}),
      ...(explicitByPartId[partId] ?? {}),
    };
  }

  for (const part of project.parts) {
    const sides = powderSidesByPartId[part.id];
    if (!sides || !part.geometry) continue;

    const current = resolved[part.id] ?? {};
    if (current.powderAreaM2 != null) continue;

    const stockPlan = resolveMaterialStockPlan(part.geometry);
    if (!(stockPlan.netAreaMm2 && stockPlan.netAreaMm2 > 0)) continue;

    resolved[part.id] = {
      ...current,
      powderAreaM2: stockPlan.netAreaMm2 / 1_000_000 * sides,
    };
  }

  return resolved;
}