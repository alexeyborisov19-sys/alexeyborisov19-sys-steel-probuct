import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PREAUTH_TTL_MS = 10 * 60_000;

function signature(value: string, key: string) {
  return createHmac("sha256", key)
    .update(`steelprodukt:pd-preauth:${value}`)
    .digest("base64url");
}

export function createPreAuthChallenge(key: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const payload = `${token}.${now.getTime()}`;
  return { token, cookieValue: `${payload}.${signature(payload, key)}` };
}

export function verifyPreAuthChallenge(
  token: string,
  cookieValue: string | undefined,
  key: string,
  now = new Date(),
) {
  if (!token || !cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [cookieToken, timestampRaw, suppliedSignature] = parts;
  const timestamp = Number(timestampRaw);
  if (cookieToken !== token || !Number.isFinite(timestamp)) return false;
  if (timestamp > now.getTime() || now.getTime() - timestamp > PREAUTH_TTL_MS) return false;
  const expected = Buffer.from(signature(`${cookieToken}.${timestampRaw}`, key));
  const actual = Buffer.from(suppliedSignature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
