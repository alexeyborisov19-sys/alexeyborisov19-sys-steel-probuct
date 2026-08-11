import { constants } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";

export const requestIdPattern = /^SP-(?:AI-)?\d{8}-[A-F0-9]{8}$/;
export const auditIdPattern = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
export const storageIdPattern = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.[a-z\d]{1,12}$/i;

export class PdSafeFileError extends Error {
  readonly code = "PD_SAFE_FILE_ERROR";

  constructor(readonly reason: "INVALID_ID" | "UNSAFE_PATH" | "SYMLINK" | "SIZE" | "TYPE" | "CORRUPT") {
    super("Protected file could not be accessed safely");
    this.name = "PdSafeFileError";
  }
}

function assertIdentifier(value: string, pattern: RegExp) {
  if (!pattern.test(value) || basename(value) !== value) throw new PdSafeFileError("INVALID_ID");
}

function isInside(root: string, candidate: string) {
  const fromRoot = relative(root, candidate);
  return fromRoot !== "" && !fromRoot.startsWith(`..${sep}`) && fromRoot !== "..";
}

export async function resolveProtectedFile(root: string, pathParts: string[]) {
  if (!resolve(root).startsWith(sep)) throw new PdSafeFileError("UNSAFE_PATH");
  const rootStat = await lstat(root).catch(() => null);
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) throw new PdSafeFileError("UNSAFE_PATH");
  const canonicalRoot = await realpath(root);
  const candidate = resolve(canonicalRoot, ...pathParts);
  if (!isInside(canonicalRoot, candidate)) throw new PdSafeFileError("UNSAFE_PATH");
  const candidateLstat = await lstat(candidate).catch(() => null);
  if (candidateLstat?.isSymbolicLink()) throw new PdSafeFileError("SYMLINK");
  if (!candidateLstat?.isFile()) throw new PdSafeFileError("TYPE");
  const canonicalCandidate = await realpath(candidate);
  if (!isInside(canonicalRoot, canonicalCandidate)) throw new PdSafeFileError("UNSAFE_PATH");
  return canonicalCandidate;
}

function assertJsonComplexity(value: unknown, maximumDepth: number, maximumNodes: number) {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const current = stack.pop();
    if (!current) break;
    nodes += 1;
    if (nodes > maximumNodes || current.depth > maximumDepth) throw new PdSafeFileError("CORRUPT");
    if (!current.value || typeof current.value !== "object") continue;
    const children = Array.isArray(current.value)
      ? current.value
      : Object.values(current.value as Record<string, unknown>);
    for (const child of children) stack.push({ value: child, depth: current.depth + 1 });
  }
}

export async function readProtectedJson<T>(
  root: string,
  id: string,
  options: { idPattern?: RegExp; maximumBytes?: number; maximumDepth?: number; maximumNodes?: number } = {},
) {
  assertIdentifier(id, options.idPattern ?? requestIdPattern);
  const path = await resolveProtectedFile(root, [`${id}.json`]);
  const fileStat = await stat(path);
  const maximumBytes = options.maximumBytes ?? 2 * 1024 * 1024;
  if (fileStat.size > maximumBytes) throw new PdSafeFileError("SIZE");
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const content = await handle.readFile({ encoding: "utf8" });
    const parsed = JSON.parse(content) as T;
    assertJsonComplexity(parsed, options.maximumDepth ?? 32, options.maximumNodes ?? 50_000);
    return parsed;
  } catch (error) {
    if (error instanceof PdSafeFileError) throw error;
    throw new PdSafeFileError("CORRUPT");
  } finally {
    await handle.close();
  }
}

export async function openProtectedAttachment(
  quarantineRoot: string,
  requestId: string,
  storageId: string,
  maximumBytes = 7 * 1024 * 1024,
) {
  assertIdentifier(requestId, requestIdPattern);
  assertIdentifier(storageId, storageIdPattern);
  const path = await resolveProtectedFile(quarantineRoot, [requestId, storageId]);
  const fileStat = await stat(path);
  if (fileStat.size > maximumBytes) throw new PdSafeFileError("SIZE");
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  return { handle, size: fileStat.size };
}

export function safeDownloadName(value: string) {
  return basename(value)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._()\- ]/gu, "_")
    .replace(/[\r\n]/g, "_")
    .slice(0, 120) || "attachment";
}
