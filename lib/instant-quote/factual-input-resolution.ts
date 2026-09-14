import type { InstantQuoteProject } from "@/lib/instant-quote/domain";
import { resolveMaterialStockPlan } from "@/lib/instant-quote/blanking";
import type { PartFactualInputs } from "@/lib/instant-quote/project-factual-calculation";

export function resolveEffectiveFactualInputs(
  project: InstantQuoteProject,
  explicitByPartId: Record<string, PartFactualInputs>,
  powderSidesByPartId: Record<string, 1 | 2>,
): Record<string, PartFactualInputs> {
  const resolved: Record<string, PartFactualInputs> = Object.fromEntries(
    Object.entries(explicitByPartId).map(([partId, value]) => [partId, { ...value }]),
  );

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
