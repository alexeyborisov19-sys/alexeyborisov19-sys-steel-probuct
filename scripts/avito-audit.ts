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

  function totals(item: AvitoItem) {
    const row = statsById.get(String(item.id));
    const stats = Array.isArray(row?.stats) ? row.stats as Record<string, unknown>[] : [];
    return stats.reduce(
      (acc, stat) => ({
        views: acc.views + Number(stat.uniqViews ?? 0),
        contacts: acc.contacts + Number(stat.uniqContacts ?? 0),
      }),
      { views: 0, contacts: 0 },
    );
  }

  let balance: unknown = null;
  let spendings: unknown = null;
  const spendingsByTitle: Record<string, unknown> = {};
  const operations: unknown[] = [];

  try {
    balance = await client.getBalance(self.id);
  } catch (error) {
    balance = { error: error instanceof Error ? error.message : String(error) };
  }

  try {
    spendings = await client.getSpendings(self.id, dateFrom, dateTo);
  } catch (error) {
    spendings = { error: error instanceof Error ? error.message : String(error) };
  }

  const spendingTitles = [
    "Лазерная резка металла",
    "Корзина для кондиционеров под заказ",
    "Порошковая покраска металла",
    "Гибка листового металла",
    "Профессиональная дробеструйная обработка",
    "Пескоструйная обработка. Дробеструй",
    "Гибка металла чпу",
    "Фасадные металлокассеты, металлокассеты",
    "Электрошкафы металлические",
    "Производство закладных деталей, полос, пластин",
    "Закладные детали, полосы, пластины",
  ];
  for (const title of spendingTitles) {
    const ids = allItems.filter((item) => item.title === title).map((item) => item.id);
    if (!ids.length) continue;
    try {
      spendingsByTitle[title] = await client.getSpendings(self.id, dateFrom, dateTo, ids);
    } catch (error) {
      spendingsByTitle[title] = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  for (let cursor = new Date(from); cursor < now; ) {
    const end = new Date(Math.min(cursor.getTime() + 7 * 86400000, now.getTime()));
    try {
      operations.push(await client.getOperationsHistory(cursor.toISOString(), end.toISOString()));
    } catch (error) {
      operations.push({ error: error instanceof Error ? error.message : String(error), dateTimeFrom: cursor.toISOString(), dateTimeTo: end.toISOString() });
    }
    cursor = end;
  }

  const basketItems = allItems
    .filter((item) => String(item.title ?? "").toLocaleLowerCase("ru-RU").includes("корзина для кондиционеров"))
    .sort((a, b) => {
      const ta = totals(a);
      const tb = totals(b);
      return (tb.contacts - ta.contacts) || (tb.views - ta.views);
    })
    .slice(0, 10);
  const cassetteItems = allItems.filter((item) => String(item.title ?? "").toLocaleLowerCase("ru-RU").includes("металлокасс"));
  const detailItems = [...new Map([...basketItems, ...cassetteItems].map((item) => [String(item.id), item])).values()];
  const detailSamples: Record<string, unknown> = {};
  for (const item of detailItems) {
    try {
      detailSamples[String(item.id)] = await client.getItemInfo(self.id, item.id);
    } catch (error) {
      detailSamples[String(item.id)] = { error: error instanceof Error ? error.message : String(error) };
    }
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
    financials: { balance, spendings, spendingsByTitle, operations },
    detailSamples,
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
