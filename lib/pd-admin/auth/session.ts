import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export const PD_SESSION_COOKIE = "__Host-steelprodukt-pd-session";

function keyedHash(value: string, key: string, purpose: string) {
  if (Buffer.byteLength(key, "utf8") < 32 && !/^[a-f\d]{64,}$/i.test(key)) {
    throw new Error("PD session hash key is unavailable or too short");
  }
  return createHmac("sha256", key).update(`steelprodukt:${purpose}:${value}`).digest("hex");
}

export type NewSession = {
  id: string;
  token: string;
  tokenHash: string;
  csrfToken: string;
  csrfSecretHash: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
};

export function createSessionSecrets(
  hashKey: string,
  now = new Date(),
  idleMinutes = 30,
  absoluteHours = 8,
): NewSession {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  const createdAt = now.toISOString();
  return {
    id: randomUUID(),
    token,
    tokenHash: keyedHash(token, hashKey, "session-token"),
    csrfToken,
    csrfSecretHash: keyedHash(csrfToken, hashKey, "csrf-token"),
    createdAt,
    lastSeenAt: createdAt,
    expiresAt: new Date(now.getTime() + idleMinutes * 60_000).toISOString(),
    absoluteExpiresAt: new Date(now.getTime() + absoluteHours * 3_600_000).toISOString(),
  };
}

export function hashSessionToken(token: string, hashKey: string) {
  return keyedHash(token, hashKey, "session-token");
}

export function hashCsrfToken(token: string, hashKey: string) {
  return keyedHash(token, hashKey, "csrf-token");
}

export function verifyCsrfToken(token: string, expectedHash: string, hashKey: string) {
  const actual = Buffer.from(hashCsrfToken(token, hashKey), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function sessionCookieOptions(maxAgeSeconds: number, production = process.env.NODE_ENV === "production") {
  return {
    name: PD_SESSION_COOKIE,
    httpOnly: true,
    secure: production,
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function isSessionActive(
  session: { expiresAt: string; absoluteExpiresAt: string; revokedAt?: string | null },
  now = new Date(),
) {
  const timestamp = now.getTime();
  return !session.revokedAt
    && Date.parse(session.expiresAt) > timestamp
    && Date.parse(session.absoluteExpiresAt) > timestamp;
}

export function isStepUpActive(stepUpUntil: string | null | undefined, now = new Date()) {
  return Boolean(stepUpUntil && Date.parse(stepUpUntil) > now.getTime());
}

export function createStepUpExpiry(minutes: number, now = new Date()) {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}
