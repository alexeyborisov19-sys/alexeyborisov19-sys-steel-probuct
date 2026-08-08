import { createHmac } from "node:crypto";
import { domainToASCII } from "node:url";

export function normalizePhone(value: string) {
  let digits = value.normalize("NFKC").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  return digits;
}

export function normalizeEmail(value: string) {
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0 || separator === normalized.length - 1) return normalized;
  const local = normalized.slice(0, separator);
  const domain = domainToASCII(normalized.slice(separator + 1));
  return `${local}@${domain}`;
}

export function contactHmac(
  kind: "phone" | "email",
  value: string,
  key: string,
  keyVersion: number,
) {
  if (Buffer.byteLength(key, "utf8") < 32 && !/^[a-f\d]{64,}$/i.test(key)) {
    throw new Error("PD search HMAC key is unavailable or too short");
  }
  const normalized = kind === "phone" ? normalizePhone(value) : normalizeEmail(value);
  if (!normalized) return null;
  return createHmac("sha256", key)
    .update(`steelprodukt:pd-search:v${keyVersion}:${kind}:${normalized}`)
    .digest("hex");
}
