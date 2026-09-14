import { createHash, timingSafeEqual } from "node:crypto";
import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { importPrivateCalculatorHtml } from "@/lib/server/instant-quote/import-private-calculator";
import { writePrivateCalculationBasis } from "@/lib/server/instant-quote/private-calculation-basis";
import { refreshAtlantikPriceSnapshot } from "@/lib/server/instant-quote/refresh-atlantik-prices";
import { PayloadTooLargeError, readMultipartForm } from "@/lib/security/request-body";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMPORT_REQUEST_BYTES = 5 * 1024 * 1024;
const IMPORT_TOKEN_ENV = "STEEL_PRODUCT_PRIVATE_BASIS_IMPORT_TOKEN_SHA256";

function noStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function configuredTokenHash() {
  const value = process.env[IMPORT_TOKEN_ENV]?.trim().toLowerCase() || "";
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function secureTokenMatch(token: string, expectedHash: string) {
  const actualHash = createHash("sha256").update(token, "utf8").digest("hex");
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function privateBasisPath() {
  const configured = process.env.STEEL_PRODUCT_PRIVATE_CALCULATION_BASIS_PATH?.trim();
  if (!configured) throw new Error("Private basis path is not configured");
  const resolved = path.resolve(configured);
  const publicRoot = path.resolve(process.cwd(), "public");
  if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("Private basis path is unsafe");
  }
  return resolved;
}

function consumedMarkerPath() {
  return `${privateBasisPath()}.owner-import-consumed`;
}

async function alreadyConsumed() {
  try {
    await access(consumedMarkerPath());
    return true;
  } catch {
    return false;
  }
}

async function markConsumed(now: Date) {
  const marker = consumedMarkerPath();
  await mkdir(path.dirname(marker), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(marker), 0o700);
  await writeFile(marker, `${now.toISOString()}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await chmod(marker, 0o600);
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    if (error instanceof CrossSiteRequestError) return noStore({ ok: false, code: "UNAUTHORIZED" }, 401);
    throw error;
  }

  const expectedHash = configuredTokenHash();
  if (!expectedHash) return noStore({ ok: false, code: "NOT_CONFIGURED" }, 503);
  const token = bearerToken(request);
  if (!token || !secureTokenMatch(token, expectedHash)) return noStore({ ok: false, code: "UNAUTHORIZED" }, 401);
  if (await alreadyConsumed()) return noStore({ ok: false, code: "ALREADY_IMPORTED" }, 410);

  try {
    const formData = await readMultipartForm(request, MAX_IMPORT_REQUEST_BYTES);
    const file = formData.get("calculator");
    if (!(file instanceof File) || file.size <= 0 || file.size > 4 * 1024 * 1024) {
      return noStore({ ok: false, code: "INVALID_FILE" }, 400);
    }
    if (!/\.html?$/i.test(file.name)) return noStore({ ok: false, code: "INVALID_FILE" }, 400);

    const now = new Date();
    const imported = importPrivateCalculatorHtml(await file.text(), now);
    await writePrivateCalculationBasis(imported.basis);

    // The calculator's embedded supplier seed is historical. Refresh and persist
    // the official supplier PDF before allowing the one-time import to close.
    const supplier = await refreshAtlantikPriceSnapshot(now, { persist: true });
    await markConsumed(now);

    return noStore({
      ok: true,
      code: "IMPORTED",
      supplierPriceRefreshed: supplier.persisted,
      supplierSourceDate: supplier.sourceDate,
      supplierRows: supplier.rowCount,
      warnings: imported.warnings,
    }, 200);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return noStore({ ok: false, code: "INVALID_FILE" }, 413);
    return noStore({ ok: false, code: "IMPORT_FAILED" }, 503);
  }
}
