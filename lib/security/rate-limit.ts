export type RateLimitRule = {
  id: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export interface RateLimitStore {
  consume(key: string, rule: RateLimitRule, now?: number): RateLimitResult;
  clear(): void;
}

type Counter = { count: number; expiresAt: number };

/**
 * Per-process limiter suitable for one PM2 worker. The interface is kept small
 * so a Redis implementation can replace it without changing route handlers.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly counters = new Map<string, Counter>();
  private operations = 0;

  consume(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
    this.operations += 1;
    if (this.operations % 250 === 0) this.cleanup(now);

    const storageKey = `${rule.id}:${key}`;
    const current = this.counters.get(storageKey);
    const counter = !current || current.expiresAt <= now
      ? { count: 0, expiresAt: now + rule.windowMs }
      : current;

    counter.count += 1;
    this.counters.set(storageKey, counter);
    const allowed = counter.count <= rule.limit;
    return {
      allowed,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - counter.count),
      retryAfterSeconds: Math.max(1, Math.ceil((counter.expiresAt - now) / 1000)),
    };
  }

  clear() {
    this.counters.clear();
    this.operations = 0;
  }

  private cleanup(now: number) {
    for (const [key, counter] of this.counters) {
      if (counter.expiresAt <= now) this.counters.delete(key);
    }
  }
}

const globalRateLimit = globalThis as typeof globalThis & {
  __steelproduktRateLimit?: InMemoryRateLimitStore;
};

export const rateLimitStore = globalRateLimit.__steelproduktRateLimit
  ?? new InMemoryRateLimitStore();

if (process.env.NODE_ENV !== "production") {
  globalRateLimit.__steelproduktRateLimit = rateLimitStore;
}

export function consumeRules(key: string, rules: RateLimitRule[]) {
  for (const rule of rules) {
    const result = rateLimitStore.consume(key, rule);
    if (!result.allowed) return result;
  }
  return null;
}

export const assistantRateRules: RateLimitRule[] = [
  { id: "assistant-minute", limit: 18, windowMs: 60_000 },
  { id: "assistant-day", limit: 250, windowMs: 86_400_000 },
];

export const leadRateRules: RateLimitRule[] = [
  { id: "lead-minute", limit: 3, windowMs: 60_000 },
  { id: "lead-day", limit: 20, windowMs: 86_400_000 },
];

export const quoteRateRules: RateLimitRule[] = [
  { id: "quote-minute", limit: 3, windowMs: 60_000 },
  { id: "quote-day", limit: 20, windowMs: 86_400_000 },
];

export function isDuplicateSubmission(fingerprint: string, route: "lead" | "quote") {
  return !rateLimitStore.consume(fingerprint, {
    id: `${route}-duplicate`,
    limit: 1,
    windowMs: 10 * 60_000,
  }).allowed;
}
