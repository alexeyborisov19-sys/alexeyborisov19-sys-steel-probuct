import { randomUUID } from "node:crypto";
import { chmod, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { QuoteRecord } from "@/lib/quote/types";

export class QuoteStorageError extends Error {
  readonly code = "STORAGE_ERROR";

  constructor() {
    super("Quote storage operation failed");
    this.name = "QuoteStorageError";
  }
}

function storageRoot() {
  return resolve(process.env.QUOTE_STORAGE_PATH || ".data/quote-leads");
}

function assertPrivateStorage(path: string) {
  const publicRoot = resolve(process.cwd(), "public");
  const fromPublic = relative(publicRoot, path);
  if (fromPublic === "" || (!fromPublic.startsWith(`..${sep}`) && fromPublic !== "..")) {
    throw new QuoteStorageError();
  }
}

async function prepareStorageRoot() {
  const root = storageRoot();
  assertPrivateStorage(root);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  return root;
}

export async function createQuoteRecord(record: QuoteRecord) {
  try {
    const root = await prepareStorageRoot();
    const recordPath = resolve(root, `${record.requestId}.json`);
    await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await chmod(recordPath, 0o600);
  } catch (error) {
    if (error instanceof QuoteStorageError) throw error;
    throw new QuoteStorageError();
  }
}

export async function updateQuoteRecord(record: QuoteRecord) {
  let temporaryPath: string | null = null;
  try {
    const root = await prepareStorageRoot();
    const recordPath = resolve(root, `${record.requestId}.json`);
    temporaryPath = resolve(root, `.${record.requestId}.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporaryPath, recordPath);
    temporaryPath = null;
    await chmod(recordPath, 0o600);
  } catch {
    if (temporaryPath) await unlink(temporaryPath).catch(() => undefined);
    throw new QuoteStorageError();
  }
}
