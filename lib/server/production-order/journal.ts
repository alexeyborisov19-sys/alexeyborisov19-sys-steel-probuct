import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { ProductionOrderPackagePlan } from "@/lib/server/production-order/storage";

export type ProductionOrderJournalEvent = {
  event:
    | "package-created"
    | "package-updated"
    | "package-unchanged"
    | "artifacts-copied"
    | "artifacts-failed"
    | "documents-generated"
    | "documents-unavailable"
    | "documents-failed"
    | "bitrix-created"
    | "bitrix-updated"
    | "bitrix-failed";
  orderId: string;
  revision: number;
  actor: {
    userId: string;
    displayName: string;
  };
  details?: Record<string, string | number | boolean | null>;
  occurredAt?: string;
};

export async function appendProductionOrderJournal(
  plan: ProductionOrderPackagePlan,
  input: ProductionOrderJournalEvent,
) {
  await mkdir(path.dirname(plan.journalPath), { recursive: true, mode: 0o700 });
  const line = `${JSON.stringify({
    ...input,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  })}\n`;
  await appendFile(plan.journalPath, line, { encoding: "utf8", mode: 0o600 });
  return plan.journalPath;
}
