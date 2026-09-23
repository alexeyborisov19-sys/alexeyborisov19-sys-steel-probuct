import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = resolve(process.cwd(), "scripts/mail-readonly.py");
const ENV_PATH = resolve(process.cwd(), ".env.production");
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER = 6 * 1024 * 1024;

type MailHeader = {
  uid: string;
  date: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  messageId: string;
  inReplyTo: string;
  references: string;
  size: number | null;
};

export type MailAttachmentSummary = {
  index: number;
  filename: string;
  contentType: string;
  size: number;
  textPreview: string | null;
};

export type MailMessage = MailHeader & {
  text: string;
  attachments: MailAttachmentSummary[];
};

export type MailStatus = {
  mailbox: "INBOX";
  messages: number | null;
  unseen: number | null;
  readOnly: true;
};

type ListResult = { readOnly: true; messages: MailHeader[] };
type SearchResult = { readOnly: true; query: string; messages: MailHeader[] };
type MessageResult = { readOnly: true; message: MailMessage };
type ThreadResult = { readOnly: true; seedUid: string; messages: MailMessage[] };

type MailFailure = {
  ok: false;
  readOnly: true;
  error: string;
};

function safeInteger(value: number, min: number, max: number) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error("Invalid read-only mail query limit.");
  }
  return String(value);
}

function safeUid(uid: string) {
  if (!/^\d+$/.test(uid)) throw new Error("Invalid mail UID.");
  return uid;
}

function parsePayload<T>(raw: string): T {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("Read-only mail service returned an invalid response.");
  }
  if (payload && typeof payload === "object" && "ok" in payload && (payload as MailFailure).ok === false) {
    throw new Error((payload as MailFailure).error || "Read-only mail operation failed.");
  }
  return payload as T;
}

async function runMailReadOnly<T>(args: string[]): Promise<T> {
  const commandArgs = [SCRIPT_PATH, "--env-file", ENV_PATH, ...args];
  try {
    const { stdout } = await execFileAsync("python3", commandArgs, {
      cwd: process.cwd(),
      env: process.env,
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: DEFAULT_MAX_BUFFER,
      encoding: "utf8",
      windowsHide: true,
    });
    return parsePayload<T>(stdout.trim());
  } catch (error) {
    const candidate = error as { stdout?: string; code?: unknown };
    if (candidate.stdout?.trim()) return parsePayload<T>(candidate.stdout.trim());
    throw new Error("Read-only mail operation failed.");
  }
}

export function readOnlyMailStatus() {
  return runMailReadOnly<MailStatus>(["status"]);
}

export function listRecentMail(options: { limit?: number; unseen?: boolean } = {}) {
  const limit = options.limit ?? 20;
  const args = ["list", "--limit", safeInteger(limit, 1, 100)];
  if (options.unseen) args.push("--unseen");
  return runMailReadOnly<ListResult>(args);
}

export function searchMailHeaders(query: string, options: { limit?: number; scanLimit?: number } = {}) {
  const clean = query.trim().slice(0, 300);
  if (!clean) throw new Error("Mail search query is empty.");
  const limit = options.limit ?? 20;
  const scanLimit = options.scanLimit ?? 200;
  return runMailReadOnly<SearchResult>([
    "search",
    clean,
    "--limit",
    safeInteger(limit, 1, 100),
    "--scan-limit",
    safeInteger(scanLimit, 1, 500),
  ]);
}

export function readMailMessage(uid: string) {
  return runMailReadOnly<MessageResult>(["message", safeUid(uid)]);
}

export function readMailThread(uid: string, options: { limit?: number; scanLimit?: number } = {}) {
  const limit = options.limit ?? 30;
  const scanLimit = options.scanLimit ?? 300;
  return runMailReadOnly<ThreadResult>([
    "thread",
    safeUid(uid),
    "--limit",
    safeInteger(limit, 1, 100),
    "--scan-limit",
    safeInteger(scanLimit, 1, 500),
  ]);
}
