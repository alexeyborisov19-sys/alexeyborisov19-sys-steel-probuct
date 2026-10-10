export type CookieChoice = {
  version: 2;
  necessary: true;
  analytics: boolean;
  updatedAt: string;
};

type ConsentStorage = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;

function parseChoice(stored: string | null): CookieChoice | null {
  try {
    const value: unknown = stored ? JSON.parse(stored) : null;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const choice = value as Partial<CookieChoice>;
    if (typeof choice.updatedAt !== "string" || !Number.isFinite(Date.parse(choice.updatedAt))) return null;
    return choice.version === 2 && choice.necessary === true && typeof choice.analytics === "boolean"
      ? choice as CookieChoice : null;
  } catch {
    return null;
  }
}

export function createCookieChoiceStore(key: string) {
  // undefined means storage remains authoritative. null is a failed grant,
  // while an explicit refusal survives even an older readable stored grant.
  let failedWriteChoice: CookieChoice | null | undefined;

  function read(getStorage: () => ConsentStorage): CookieChoice | null {
    if (failedWriteChoice !== undefined) return failedWriteChoice;
    try { return parseChoice(getStorage().getItem(key)); } catch { return null; }
  }

  function write(analytics: boolean, getStorage: () => ConsentStorage): boolean {
    const choice: CookieChoice = { version: 2, necessary: true, analytics, updatedAt: new Date().toISOString() };
    // Set before touching storage: a refusal is authoritative even if access throws.
    failedWriteChoice = analytics ? null : choice;
    try {
      const storage = getStorage();
      storage.setItem(key, JSON.stringify(choice));
      if (storage.getItem(key) !== JSON.stringify(choice)) return false;
      failedWriteChoice = undefined;
      return true;
    } catch {
      if (!analytics) {
        // Quota errors can still permit removing an older grant. No reload is
        // needed to stop the current runtime, even if removal also fails.
        try { getStorage().removeItem?.(key); } catch { /* Refusal remains in memory. */ }
      }
      return false;
    }
  }

  function canReloadAfterRevocation(getStorage: () => ConsentStorage) {
    if (failedWriteChoice !== undefined) return false;
    try { return parseChoice(getStorage().getItem(key))?.analytics === false; } catch { return false; }
  }

  return { read, write, canReloadAfterRevocation };
}

export function observeCookieChoiceStorage(options: {
  target: EventTarget;
  key: string;
  consentEvent: string;
  getStorage: () => ConsentStorage;
}) {
  const { target, key, consentEvent, getStorage } = options;
  function onStorage(event: Event) {
    const change = event as StorageEvent;
    if (change.key !== key && change.key !== null) return;
    try {
      if (change.storageArea && change.storageArea !== getStorage()) return;
    } catch { /* A denied storage read must fail closed below. */ }
    // Read current storage in subscribers, not possibly stale event.newValue.
    target.dispatchEvent(new Event(consentEvent));
  }
  target.addEventListener("storage", onStorage);
  return () => target.removeEventListener("storage", onStorage);
}
