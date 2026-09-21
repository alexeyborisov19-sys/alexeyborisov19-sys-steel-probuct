import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { validMarketSpec } from "@/lib/quote-engine/market-floor";

export type TrustedMarketFeed = { supplierId: string; url: string };
export type MarketFeedReader = (url: string) => Promise<unknown>;
function object(raw: unknown): Record<string, unknown> | null {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
}
export function publicFeedUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port
      || isIP(url.hostname) || !url.hostname.includes(".")
      || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(url.hostname)) return null;
    return url;
  } catch { return null; }
}
/** Conservative IPv4-only egress. Special-use and non-public destinations are rejected. */
export function publicFeedAddress(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

/** Exact operator-registered URL, pinned checked DNS address, TLS verification, no redirects or auth. */
export const readPublicMarketFeed: MarketFeedReader = async (rawUrl) => {
  const url = publicFeedUrl(rawUrl);
  if (!url) throw new Error("Invalid feed URL");
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, family: 4 }),
    new Promise<never>((_resolve, reject) => { dnsTimer = setTimeout(() => reject(new Error("Feed DNS timeout")), 2000); }),
  ]).finally(() => { if (dnsTimer) clearTimeout(dnsTimer); });
  if (!addresses.length || !addresses.every((entry) => publicFeedAddress(entry.address))) throw new Error("Non-public feed destination");
  const pinned = addresses[0].address;
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, {
      method: "GET", agent: false, family: 4,
      headers: { Accept: "application/json", "Accept-Encoding": "identity", "User-Agent": "SteelProdukt-QuoteReference/1.0" },
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [{ address: pinned, family: 4 }]);
        else callback(null, pinned, 4);
      },
    }, (res) => {
      if (res.statusCode !== 200 || !/^application\/(?:[a-z0-9.+-]*\+)?json(?:;|$)/i.test(res.headers["content-type"] ?? "")
        || (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")) {
        res.destroy(); reject(new Error("Unsupported feed response")); return;
      }
      const limit = 262_144;
      if (Number(res.headers["content-length"] ?? 0) > limit) { res.destroy(); reject(new Error("Feed too large")); return; }
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (data: Buffer) => {
        size += data.length;
        if (size > limit) { res.destroy(new Error("Feed too large")); return; }
        chunks.push(data);
      });
      res.on("error", reject);
      res.on("end", () => {
        try { resolve(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)))); }
        catch { reject(new Error("Invalid feed JSON")); }
      });
    });
    const timer = setTimeout(() => req.destroy(new Error("Feed timeout")), 4000);
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject); req.end();
  });
};

/** The supplier comes from the operator's allowlist, never from model output or feed assertions. */
export function offersFromFeed(raw: unknown, source: TrustedMarketFeed, now = new Date()): unknown[] {
  const payload = object(raw);
  if (!publicFeedUrl(source.url) || !source.supplierId.trim() || source.supplierId.length > 200
    || !payload || payload.version !== "market-source-offers-v1" || !Array.isArray(payload.offers)
    || payload.offers.length > 100 || !Number.isFinite(now.getTime())) return [];
  return payload.offers.flatMap((rawOffer) => {
    const offer = object(rawOffer);
    if (!offer || !validMarketSpec(offer.specification)) return [];
    const evidence = JSON.stringify(offer);
    if (evidence.length > 8000) return [];
    return [{ ...offer,
      supplierId: source.supplierId, sourceUrl: source.url,
      capturedAt: now.toISOString(), checkedAt: now.toISOString(),
      checkedBy: `structured-source-v1:${createHash("sha256").update(evidence).digest("hex")}`,
      evidence,
    }];
  });
}

const cache = new Map<string, { until: number; offers: unknown[] }>();
const pending = new Map<string, Promise<unknown[]>>();
/** Explicitly enabled structured source adapters; arbitrary search links are never approved automatically. */
export async function hydrateMarketRegistry(
  raw: unknown,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  reader: MarketFeedReader = readPublicMarketFeed,
): Promise<unknown> {
  const registry = object(raw);
  if (!registry || registry.version !== "verified-market-offers-v1" || !Array.isArray(registry.offers)
    || registry.offers.length > 100 || environment.STEEL_PRODUCT_MARKET_SOURCE_FETCH_ENABLED !== "true") return raw;
  if (!Array.isArray(registry.trustedFeeds) || registry.trustedFeeds.length > 8) return raw;
  const sources = registry.trustedFeeds.flatMap((value) => {
    const source = object(value);
    return source && typeof source.supplierId === "string" && source.supplierId.trim()
      && source.supplierId.length <= 200 && publicFeedUrl(source.url)
      ? [{ supplierId: source.supplierId, url: String(source.url) }] : [];
  });
  const collected: unknown[] = [];
  // Two simultaneous network requests; source failures preserve a calculable own-price quote.
  let next = 0;
  const worker = async () => {
    while (next < sources.length) {
      const source = sources[next++], key = JSON.stringify(source);
      const cached = reader === readPublicMarketFeed ? cache.get(key) : undefined;
      if (cached && cached.until > Date.now()) { collected.push(...structuredClone(cached.offers)); continue; }
      const task = (async () => {
        try {
          const offers = offersFromFeed(await reader(source.url), source);
          if (reader === readPublicMarketFeed) {
            if (cache.size >= 32) cache.delete(cache.keys().next().value!);
            cache.set(key, { until: Date.now() + (offers.length ? 900_000 : 30_000), offers });
          }
          return offers;
        } catch { return []; }
      });
      let work = reader === readPublicMarketFeed ? pending.get(key) : undefined;
      if (!work) { work = task(); if (reader === readPublicMarketFeed) pending.set(key, work); }
      try { collected.push(...structuredClone(await work)); }
      finally { if (reader === readPublicMarketFeed && pending.get(key) === work) pending.delete(key); }
    }
  };
  await Promise.all([worker(), worker()]);
  return { ...registry, offers: [...collected, ...registry.offers].slice(0, 100) };
}
