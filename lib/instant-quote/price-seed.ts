import type { StoredPriceSnapshot } from "@/lib/instant-quote/material-price-feed";

/**
 * Public/client code must never contain supplier purchase prices.
 *
 * This compatibility export intentionally stays empty. Production material
 * prices are loaded only by the protected server-side calculation/reporting
 * path and are never shipped to the browser or committed to this repository.
 */
export const FALLBACK_METAL_PRICE_SNAPSHOTS: StoredPriceSnapshot[] = [];
