import { randomUUID } from "node:crypto";
import { emptyLeadState } from "./state";
import type { AssistantSession } from "./types";

export interface AssistantSessionStore {
  create(ownerKey: string): AssistantSession;
  get(id: string, ownerKey: string): AssistantSession | undefined;
  save(session: AssistantSession): void;
  clear(): void;
}

const SESSION_TTL_MS = 4 * 60 * 60_000;

export class InMemoryAssistantSessionStore implements AssistantSessionStore {
  private readonly sessions = new Map<string, AssistantSession>();
  private operations = 0;

  create(ownerKey: string) {
    const now = Date.now();
    const session: AssistantSession = {
      id: randomUUID(),
      ownerKey,
      state: emptyLeadState(),
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string, ownerKey: string) {
    this.operations += 1;
    if (this.operations % 100 === 0) this.cleanup();
    const session = this.sessions.get(id);
    if (!session || session.ownerKey !== ownerKey || Date.now() - session.updatedAt > SESSION_TTL_MS) {
      if (session) this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  save(session: AssistantSession) {
    session.updatedAt = Date.now();
    session.history = session.history.slice(-24);
    this.sessions.set(session.id, session);
  }

  clear() {
    this.sessions.clear();
  }

  private cleanup() {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [id, session] of this.sessions) {
      if (session.updatedAt < cutoff) this.sessions.delete(id);
    }
  }
}

const globalSessions = globalThis as typeof globalThis & {
  __steelproduktAssistantSessions?: InMemoryAssistantSessionStore;
};

export const assistantSessionStore = globalSessions.__steelproduktAssistantSessions
  ?? new InMemoryAssistantSessionStore();

if (process.env.NODE_ENV !== "production") {
  globalSessions.__steelproduktAssistantSessions = assistantSessionStore;
}
