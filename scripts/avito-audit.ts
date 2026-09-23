import { writeFile } from "node:fs/promises";
import { AvitoClient, type AvitoItem } from "../lib/avito/client";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeTitle(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replace(/[^a-zа-яё0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

function extractStatRows(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const result = obj.result && typeof obj.result === "object" ? obj.result as Record<string, unknown> : {};
  for (const candidate of [obj.items, obj.resources, result.items, result.resources]) {
    if (Array.isArray(candidate)) return candidate.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"));
  }
  return [];
}

async function main() {
  const client = AvitoClient.fromEnv();
  const self = await client.getSelf();

  const allItems: AvitoItem[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const { items } = await client.listItems({ perPage: 100, page });
    allItems.push(...items);
    if (items.length < 100) break;
  }

  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 30);
  const dateFrom = process.env.AVITO_AUDIT_DATE_FROM?.trim() || isoDate(from);
  const dateTo = process.env.AVITO_AUDIT_DATE_TO?.trim() || isoDate(now);

  const statRows: Record<string, unknown>[] = [];
  for (const ids of chunk(allItems.map((item) => item.id), 50)) {
    if (!ids.length) continue;
    const raw = await client.getItemStats(self.id, ids, dateFrom, dateTo);
    statRows.push(...extractStatRows(raw));
  }

  const statsById = new Map<string, Record<string, unknown>>();
  for (const row of statRows) {
    const id = row.itemId ?? row.item_id ?? row.id;
    if (id !== undefined && id !== null) statsById.set(String(id), row);
  }

  const titleGroups = new Map<string, string[]>();
  for (const item of allItems) {
    const key = normalizeTitle(item.title);
    if (!key) continue;
    const current = titleGroups.get(key) ?? [];
    current.push(String(item.id));
    titleGroups.set(key, current);
  }

  const duplicateIds = new Set(
    [...titleGroups.values()].filter((ids) => ids.length > 1).flat(),
  );

  const rows = allItems.map((item) => ({
    id: item.id,
    title: item.title ?? null,
    status: item.status ?? null,
    url: item.url ?? null,
    price: item.price ?? null,
    duplicateTitleCandidate: duplicateIds.has(String(item.id)),
    stats: statsById.get(String(item.id)) ?? null,
    source: item,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    account: {
      id: self.id,
      name: self.name ?? null,
    },
    period: { dateFrom, dateTo },
    counts: {
      totalItems: rows.length,
      duplicateTitleCandidates: rows.filter((row) => row.duplicateTitleCandidate).length,
      statsMatched: rows.filter((row) => row.stats).length,
    },
    note: "This report is read-only. Duplicate-title flags are candidates for human review, not automatic deletion decisions.",
    items: rows,
  };

  const output = process.env.AVITO_AUDIT_OUTPUT?.trim() || "/tmp/avito-audit.json";
  await writeFile(output, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ output, ...report.counts, period: report.period }, null, 2));
}

main().catch((error) => {
  const safe = error instanceof Error ? error.message : String(error);
  console.error(`Avito audit failed: ${safe}`);
  process.exitCode = 1;
});
