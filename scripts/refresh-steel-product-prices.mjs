const args = new Set(process.argv.slice(2));
const allowed = new Set(["--commit", "--dry-run"]);
for (const arg of args) {
  if (!allowed.has(arg)) {
    console.error(`Unknown argument: ${arg}`);
    process.exit(2);
  }
}
if (args.has("--commit") && args.has("--dry-run")) {
  console.error("Choose either --commit or --dry-run, not both.");
  process.exit(2);
}

const commit = args.has("--commit");
const token = process.env.STEEL_PRODUCT_PRICE_REFRESH_TOKEN?.trim() || "";
if (token.length < 32) {
  console.error("STEEL_PRODUCT_PRICE_REFRESH_TOKEN is missing or too short.");
  process.exit(2);
}

const rawPort = process.env.STEEL_PRODUCT_PRICE_REFRESH_PORT?.trim() || "3000";
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("STEEL_PRODUCT_PRICE_REFRESH_PORT must be an integer from 1 to 65535.");
  process.exit(2);
}

const url = new URL(`http://127.0.0.1:${port}/api/internal/online-order/refresh-prices`);
if (commit) url.searchParams.set("commit", "1");

let response;
try {
  response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(45_000),
  });
} catch {
  console.error("Supplier price refresh endpoint is unavailable on loopback.");
  process.exit(1);
}

let body = null;
try {
  body = await response.json();
} catch {
  // Keep failure output intentionally generic; never dump an upstream page.
}

if (!response.ok || !body?.ok) {
  console.error(`Supplier price refresh failed: ${body?.code || `HTTP_${response.status}`}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  mode: body.mode,
  sourceId: body.sourceId,
  sourceDate: body.sourceDate,
  rowCount: body.rowCount,
  materialCounts: body.materialCounts,
  contentChanged: body.contentChanged,
  persisted: body.persisted,
}, null, 2));
