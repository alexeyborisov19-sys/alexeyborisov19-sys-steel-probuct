export type CookieChoice = {
  version: 2;
  necessary: true;
  analytics: boolean;
  updatedAt: string;
};

export type ConsentStorage = Pick<Storage, "getItem" | "setItem">;

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

/** A denied write keeps only this document's explicit choice; a missing or
 * invalid readable record is never replaced by an older in-memory permission. */
export function createCookieChoiceStore(key: string) {
  let transientChoice: CookieChoice | null = null;
  let volatileChoice = false;

  function read(getStorage: () => ConsentStorage): CookieChoice | null {
    if (volatileChoice) return transientChoice;
    let stored: string | null;
    try {
      stored = getStorage().getItem(key);
    } catch {
      return transientChoice;
    }
    transientChoice = parseCookieChoice(stored);
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
    }
    return choice;
  }

  function invalidate() {
    transientChoice = null;
    volatileChoice = false;
  }

  return { read, write, invalidate };
}

/** Read the current value instead of event.newValue: queued storage events may
 * be stale. A reload removes vendor code that has already executed in this tab. */
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
      // Invalidate first so blocked storage cannot resurrect an old permission.
    }
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
