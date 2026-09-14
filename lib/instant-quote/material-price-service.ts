import {
  TRUSTED_METAL_PRICE_SOURCES,
  selectBestStoredPrice,
  shouldRefreshPriceFeeds,
} from "@/lib/instant-quote/material-price-feed";
import { FALLBACK_METAL_PRICE_SNAPSHOTS } from "@/lib/instant-quote/price-seed";
import type { MaterialId } from "@/lib/instant-quote/pricing";

export type MaterialPriceCatalog = {
  generatedAt: string;
  refreshRequired: boolean;
  automaticRefreshEnabled: boolean;
  supplierUpliftPct: number;
  sources: Array<{
    id: string;
    label: string;
    enabled: boolean;
    role: string;
    priority: number;
    region?: string;
  }>;
  snapshots: typeof FALLBACK_METAL_PRICE_SNAPSHOTS;
};

export function getMaterialPriceCatalog(now = new Date()): MaterialPriceCatalog {
  return {
    generatedAt: now.toISOString(),
    refreshRequired: shouldRefreshPriceFeeds(FALLBACK_METAL_PRICE_SNAPSHOTS, now),
    // The architecture is ready, but live PDF/XLSX parsing is not enabled until the
    // authoritative supplier adapters are implemented and build-tested.
    automaticRefreshEnabled: false,
    supplierUpliftPct: 5,
    sources: TRUSTED_METAL_PRICE_SOURCES.map((source) => ({
      id: source.id,
      label: source.label,
      enabled: source.enabled,
      role: source.role,
      priority: source.priority,
      region: source.region,
    })),
    snapshots: FALLBACK_METAL_PRICE_SNAPSHOTS,
  };
}

export function getSelectedMaterialPrice(
  materialId: MaterialId,
  thicknessMm: number,
  now = new Date(),
) {
  return selectBestStoredPrice(
    FALLBACK_METAL_PRICE_SNAPSHOTS,
    materialId,
    thicknessMm,
    now,
  );
}
