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
 * without an explicit side count for coating or surface preparation leaves that
 * article incomplete.
 */
export function resolveEffectiveFactualInputs(
  project: InstantQuoteProject,
  explicitByPartId: Record<string, PartFactualInputs>,
  powderSidesByPartId: Record<string, 1 | 2>,
  authoritativeByPartId: Record<string, PartFactualInputs> = {},
  surfacePreparationSidesByPartId: Record<string, 1 | 2> = {},
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

  // Coating and surface preparation are both derived the same way: the part's
  // own net area times the number of sides the customer selected. Neither is
  // invented — with no explicit side count the article stays incomplete.
  const derivations = [
    { sidesByPartId: powderSidesByPartId, field: "powderAreaM2" },
    { sidesByPartId: surfacePreparationSidesByPartId, field: "surfacePreparationAreaM2" },
  ] as const;

  for (const { sidesByPartId, field } of derivations) {
    for (const part of project.parts) {
      const sides = sidesByPartId[part.id];
      if (!sides || !part.geometry) continue;

      const current = resolved[part.id] ?? {};
      if (current[field] != null) continue;

      const stockPlan = resolveMaterialStockPlan(part.geometry);
      if (!(stockPlan.netAreaMm2 && stockPlan.netAreaMm2 > 0)) continue;

      resolved[part.id] = {
        ...current,
        [field]: stockPlan.netAreaMm2 / 1_000_000 * sides,
      };
    }
  }

  return resolved;
}