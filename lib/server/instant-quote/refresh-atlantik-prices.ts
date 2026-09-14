import "server-only";

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseAtlantikSheetPriceText } from "@/lib/instant-quote/atlantik-price-parser";
import type { StoredPriceSnapshot } from "@/lib/instant-quote/material-price-feed";
import {
  loadPrivateCalculationBasis,
  replacePrivateMaterialPriceSnapshot,
} from "@/lib/server/instant-quote/private-calculation-basis";

const SOURCE_ID = "atlantik-smolensk";
const SOURCE_URL = "https://atlantik-company.com/price.pdf";
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const EXTRACT_TIMEOUT_MS = 20_000;
const ALLOWED_HOSTS = new Set(["atlantik-company.com", "www.atlantik-company.com"]);

function sourceDate(response: Response, now: Date) {
  const modified = response.headers.get("last-modified");
  if (modified && Number.isFinite(Date.parse(modified))) {
    return new Date(modified).toISOString().slice(0, 10);
  }
  return now.toISOString().slice(0, 10);
}

function validateFinalUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Atlantik price refresh followed an untrusted redirect");
  }
}

async function extractPdfText(pdf: Buffer) {
  const directory = await mkdtemp(path.join(tmpdir(), "steelprodukt-atlantik-"));
  const pdfPath = path.join(directory, "price.pdf");
  const textPath = path.join(directory, "price.txt");
  await chmod(directory, 0o700);

  try {
    await writeFile(pdfPath, pdf, { mode: 0o600, flag: "wx" });
    await chmod(pdfPath, 0o600);
    const command = process.env.STEEL_PRODUCT_PDFTOTEXT_COMMAND?.trim() || "pdftotext";

    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, ["-layout", "-enc", "UTF-8", pdfPath, textPath], {
        shell: false,
        stdio: ["ignore", "ignore", "pipe"],
      });
      let stderr = "";
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };

      child.stderr?.on("data", (chunk) => {
        if (stderr.length < 4096) stderr += String(chunk).slice(0, 4096 - stderr.length);
      });
      child.once("error", (error) => finish(error));
      child.once("exit", (code) => {
        if (code === 0) finish();
        else finish(new Error(`pdftotext failed (${code ?? "unknown"}): ${stderr.trim().slice(0, 400)}`));
      });

      timeout = setTimeout(() => {
        child.kill("SIGKILL");
        finish(new Error("pdftotext timed out"));
      }, EXTRACT_TIMEOUT_MS);
      timeout.unref();
    });

    await chmod(textPath, 0o600);
    const text = await readFile(textPath, "utf8");
    if (!text.trim()) throw new Error("Atlantik PDF text extraction returned an empty document");
    return text;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function validateRows(rows: ReturnType<typeof parseAtlantikSheetPriceText>) {
  const counts = { hot: 0, cold: 0, zinc: 0 };
  for (const row of rows) {
    if (row.materialId === "hot" || row.materialId === "cold" || row.materialId === "zinc") counts[row.materialId] += 1;
    if (!(row.thicknessMm >= 0.2 && row.thicknessMm <= 100)) throw new Error("Atlantik parser produced an implausible thickness");
    if (!(row.rubPerTon >= 10_000 && row.rubPerTon <= 2_000_000)) throw new Error("Atlantik parser produced an implausible price");
    if (row.rubPerTonFrom3t != null && !(row.rubPerTonFrom3t >= 10_000 && row.rubPerTonFrom3t <= 2_000_000)) {
      throw new Error("Atlantik parser produced an implausible 3t price");
    }
  }

  if (counts.hot < 5 || counts.cold < 3 || counts.zinc < 3) {
    throw new Error(`Atlantik price sanity check failed: hot=${counts.hot}, cold=${counts.cold}, zinc=${counts.zinc}`);
  }
  return counts;
}

function contentSha256(rows: StoredPriceSnapshot["rows"]) {
  const canonicalRows = rows
    .map((row) => ({
      materialId: row.materialId,
      thicknessMm: row.thicknessMm,
      rubPerTon: row.rubPerTon,
      rubPerTonFrom3t: row.rubPerTonFrom3t ?? null,
      size: row.size ?? null,
      exactThickness: row.exactThickness ?? null,
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return createHash("sha256").update(JSON.stringify(canonicalRows), "utf8").digest("hex");
}

async function previousSourceHash() {
  try {
    const basis = await loadPrivateCalculationBasis();
    const snapshot = basis.materialPriceSnapshots.find((item) => item.sourceId === SOURCE_ID);
    if (!snapshot) return null;
    return snapshot.contentSha256 ?? contentSha256(snapshot.rows);
  } catch {
    // Dry-run must still be able to validate the upstream document when a local
    // private basis is not configured yet. Commit mode will fail closed later.
    return null;
  }
}

export type AtlantikRefreshResult = {
  sourceId: typeof SOURCE_ID;
  sourceDate: string;
  fetchedAt: string;
  rowCount: number;
  materialCounts: { hot: number; cold: number; zinc: number };
  contentChanged: boolean | null;
  persisted: boolean;
};

export type AtlantikRefreshOptions = {
  /** False validates the complete feed without modifying the private basis. */
  persist?: boolean;
};

/**
 * Downloads the official Atlantik PDF, extracts its text locally, validates the
 * parsed sheet rows and, only when explicitly requested, atomically replaces
 * Atlantik's private snapshot. On any error the previous snapshot remains
 * untouched. Supplier prices are never returned to the caller.
 */
export async function refreshAtlantikPriceSnapshot(
  now = new Date(),
  options: AtlantikRefreshOptions = {},
): Promise<AtlantikRefreshResult> {
  const persist = options.persist ?? true;
  const response = await fetch(SOURCE_URL, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "SteelProdukt-Private-Price-Refresh/1.0" },
  });
  if (!response.ok) throw new Error(`Atlantik price HTTP ${response.status}`);
  validateFinalUrl(response.url || SOURCE_URL);

  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > MAX_PDF_BYTES) throw new Error("Atlantik price PDF exceeds the maximum size");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_PDF_BYTES) throw new Error("Atlantik price PDF size is invalid");
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Atlantik price response is not a PDF");

  const fetchedAt = now.toISOString();
  const effectiveSourceDate = sourceDate(response, now);
  const text = await extractPdfText(bytes);
  const rows = parseAtlantikSheetPriceText(text, {
    sourceDate: effectiveSourceDate,
    fetchedAt,
  });
  const materialCounts = validateRows(rows);
  const nextContentSha256 = contentSha256(rows);
  const previousContentSha256 = await previousSourceHash();
  const snapshot: StoredPriceSnapshot = {
    sourceId: SOURCE_ID,
    fetchedAt,
    sourceDate: effectiveSourceDate,
    status: "ok",
    contentSha256: nextContentSha256,
    rows,
  };

  if (persist) await replacePrivateMaterialPriceSnapshot(snapshot);
  return {
    sourceId: SOURCE_ID,
    sourceDate: effectiveSourceDate,
    fetchedAt,
    rowCount: rows.length,
    materialCounts,
    contentChanged: previousContentSha256 == null ? null : previousContentSha256 !== nextContentSha256,
    persisted: persist,
  };
}
