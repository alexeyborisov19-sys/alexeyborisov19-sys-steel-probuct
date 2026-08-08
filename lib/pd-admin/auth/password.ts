import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_FORMAT = "scrypt";
const PASSWORD_VERSION = 1;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export type PasswordPolicyResult = {
  valid: boolean;
  reasons: string[];
};

export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const reasons: string[] = [];
  if (password.length < 14) reasons.push("minimum-length");
  if (Buffer.byteLength(password, "utf8") > 256) reasons.push("maximum-length");
  if (!/[a-zа-яё]/u.test(password)) reasons.push("lowercase-letter");
  if (!/[A-ZА-ЯЁ]/u.test(password)) reasons.push("uppercase-letter");
  if (!/\d/u.test(password)) reasons.push("digit");
  if (!/[^\p{L}\p{N}\s]/u.test(password)) reasons.push("special-character");
  return { valid: reasons.length === 0, reasons };
}

export function hashPassword(password: string) {
  const policy = checkPasswordPolicy(password);
  if (!policy.valid) throw new Error("Password does not satisfy the administrative password policy");
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return [
    PASSWORD_FORMAT,
    PASSWORD_VERSION,
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export function verifyPassword(password: string, encoded: string) {
  const [format, versionRaw, nRaw, rRaw, pRaw, saltRaw, hashRaw] = encoded.split("$");
  if (format !== PASSWORD_FORMAT || Number(versionRaw) !== PASSWORD_VERSION || !saltRaw || !hashRaw) return false;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (N !== SCRYPT_OPTIONS.N || r !== SCRYPT_OPTIONS.r || p !== SCRYPT_OPTIONS.p) return false;
  try {
    const expected = Buffer.from(hashRaw, "base64url");
    const actual = scryptSync(password, Buffer.from(saltRaw, "base64url"), expected.length, SCRYPT_OPTIONS);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export const passwordAlgorithm = PASSWORD_FORMAT;
export const passwordVersion = PASSWORD_VERSION;
