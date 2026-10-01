export type CookieChoice = {
  version: 2;
  necessary: true;
  analytics: boolean;
  updatedAt: string;
};

export type ConsentStorage = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;

export function parseCookieChoice(stored: string | null): CookieChoice | null {
  if (!stored) return null;
  try {
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const parsed = value as Partial<CookieChoice>;
    if (parsed.version !== 2 || parsed.necessary !== true || typeof parsed.analytics !== "boolean") return null;
    if (typeof parsed.updatedAt !== "string" || !Number.isFinite(Date.parse(parsed.updatedAt))) return null;
    return { version: 2, necessary: true, analytics: parsed.analytics, updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

/** Only a deliberate current-document choice survives a denied write.
 * Readable missing/invalid records and failed reads never revive cached grants. */
export function createCookieChoiceStore(key: string) {
  let transientChoice: CookieChoice | null = null;
  let volatileChoice = false;

  function read(getStorage: () => ConsentStorage): CookieChoice | null {
    if (volatileChoice) return transientChoice;
    try {
      transientChoice = parseCookieChoice(getStorage().getItem(key));
    } catch {
      transientChoice = null;
    }
    return transientChoice;
  }

  function write(analytics: boolean, getStorage: () => ConsentStorage): CookieChoice {
    const choice: CookieChoice = { version: 2, necessary: true, analytics, updatedAt: new Date().toISOString() };
    transientChoice = choice;
    volatileChoice = false;
    try {
      getStorage().setItem(key, JSON.stringify(choice));
    } catch {
      volatileChoice = true;
      if (!analytics) {
        // A quota error can prevent replacement while still permitting removal.
        // Never leave an older grant behind when the browser lets us remove it.
        try { getStorage().removeItem?.(key); } catch { /* Current document remains opted out. */ }
      }
    }
    return choice;
  }

  function invalidate() {
    transientChoice = null;
    volatileChoice = false;
  }

  function hasVolatileRefusal() {
    return volatileChoice && transientChoice?.analytics === false;
  }

  function canReloadAfterRevocation(getStorage: () => ConsentStorage) {
    try {
      // Inspect persistent storage, not the in-memory override that a reload loses.
      return parseCookieChoice(getStorage().getItem(key))?.analytics !== true;
    } catch {
      return false;
    }
  }

  return { read, write, invalidate, hasVolatileRefusal, canReloadAfterRevocation };
}

/** Read current storage instead of event.newValue: queued events can be stale.
 * Dispatch revocation before reloading so running analytics is stopped first. */
export function observeCookieChoiceStorage(options: {
  target: EventTarget;
  key: string;
  consentEvent: string;
  getStorage: () => ConsentStorage;
  store: ReturnType<typeof createCookieChoiceStore>;
  onRevoked: () => void;
}) {
  const { target, key, consentEvent, getStorage, store, onRevoked } = options;
  let previouslyAllowed = store.read(getStorage)?.analytics === true;
  const rememberChoice = () => { previouslyAllowed = store.read(getStorage)?.analytics === true; };
  const receiveStorage = (event: Event) => {
    const change = event as StorageEvent;
    if (change.key !== key && change.key !== null) return;
    try {
      if (change.storageArea && change.storageArea !== getStorage()) return;
    } catch {
      // A failed read below must invalidate any cached persistent permission.
    }
    // An unpersisted explicit refusal must not be undone by a stale stored grant.
    if (store.hasVolatileRefusal()) return;
    const wasAllowed = previouslyAllowed;
    store.invalidate();
    previouslyAllowed = store.read(getStorage)?.analytics === true;
    target.dispatchEvent(new Event(consentEvent));
    if (wasAllowed && !previouslyAllowed) onRevoked();
  };
  target.addEventListener(consentEvent, rememberChoice);
  target.addEventListener("storage", receiveStorage);
  return () => {
    target.removeEventListener(consentEvent, rememberChoice);
    target.removeEventListener("storage", receiveStorage);
  };
}
