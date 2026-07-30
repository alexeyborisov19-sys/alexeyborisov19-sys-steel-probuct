import { readdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const apply = process.argv.includes("--apply");
const roots = [
  resolve(process.env.ASSISTANT_LEAD_STORAGE_PATH || ".data/assistant-leads"),
  resolve(process.env.QUOTE_STORAGE_PATH || ".data/quote-leads"),
  resolve(process.env.CONSENT_AUDIT_STORAGE_PATH || ".data/consent-audit"),
];
const quarantineRoot = resolve(process.env.UPLOAD_QUARANTINE_PATH || ".data/quarantine");
const now = Date.now();
let candidates = 0;
let removed = 0;

for (const root of roots) {
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = resolve(root, entry.name);
    let record;
    try {
      record = JSON.parse(await readFile(path, "utf8"));
    } catch {
      continue;
    }
    const createdAt = Date.parse(String(record.createdAt || ""));
    const retentionDays = Number(record.retentionDays);
    if (!Number.isFinite(createdAt) || !Number.isInteger(retentionDays) || retentionDays < 1) continue;
    if (now - createdAt < retentionDays * 86_400_000) continue;

    candidates += 1;
    if (!apply) continue;
    await rm(path, { force: true });
    if (
      root !== resolve(process.env.CONSENT_AUDIT_STORAGE_PATH || ".data/consent-audit")
      && typeof record.requestId === "string"
      && /^[A-Z0-9-]+$/.test(record.requestId)
    ) {
      await rm(resolve(quarantineRoot, record.requestId), { recursive: true, force: true });
    }
    removed += 1;
  }
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  candidates,
  removed,
  timestamp: new Date().toISOString(),
}));
