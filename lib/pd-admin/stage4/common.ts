import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { recordAccessEventInTransaction, type AccessEventInput } from "@/lib/pd-admin/audit/chain";

export const stage4IdPattern = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

export class PdStage4Error extends Error {
  constructor(readonly code: "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "STEP_UP_REQUIRED" | "BLOCKED") {
    super(code);
    this.name = "PdStage4Error";
  }
}

export function stage4Id(value: unknown) {
  if (typeof value !== "string" || !stage4IdPattern.test(value)) throw new PdStage4Error("NOT_FOUND");
  return value;
}

export function optionalStage4Id(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return stage4Id(value);
}

export function newStage4Id() {
  return randomUUID();
}

export function requiredText(value: unknown, minimum = 2, maximum = 4_000) {
  const text = typeof value === "string" ? value.normalize("NFKC").trim() : "";
  if (text.length < minimum || text.length > maximum) throw new PdStage4Error("VALIDATION_ERROR");
  return text;
}

export function optionalText(value: unknown, maximum = 4_000) {
  if (value === null || value === undefined || value === "") return null;
  return requiredText(value, 1, maximum);
}

export function isoDate(value: unknown) {
  const text = requiredText(value, 10, 40);
  if (!Number.isFinite(Date.parse(text))) throw new PdStage4Error("VALIDATION_ERROR");
  return new Date(text).toISOString();
}

export function positiveVersion(value: unknown) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw new PdStage4Error("VALIDATION_ERROR");
  return version;
}

export function nonNegativeInteger(value: unknown, fallback?: number) {
  if ((value === null || value === undefined || value === "") && fallback !== undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new PdStage4Error("VALIDATION_ERROR");
  return parsed;
}

export function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new PdStage4Error("VALIDATION_ERROR");
  return value as T;
}

export function stringArray(value: unknown, maximum = 100) {
  if (!Array.isArray(value) || value.length > maximum) throw new PdStage4Error("VALIDATION_ERROR");
  return value.map((item) => requiredText(item, 1, 200));
}

export function auditedTransaction<T>(context: PdAuthContext, event: AccessEventInput, callback: (database: DatabaseSync) => T) {
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  context.database.exec("BEGIN IMMEDIATE");
  try {
    const result = callback(context.database);
    recordAccessEventInTransaction(context.database, event, context.config.auditChainKey);
    context.database.exec("COMMIT");
    return result;
  } catch (error) {
    context.database.exec("ROLLBACK");
    throw error;
  }
}

export function assertChanged(changes: number | bigint) {
  if (Number(changes) !== 1) throw new PdStage4Error("CONFLICT");
}

export function parseJsonObject(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function nowIso(now = new Date()) {
  return now.toISOString();
}
