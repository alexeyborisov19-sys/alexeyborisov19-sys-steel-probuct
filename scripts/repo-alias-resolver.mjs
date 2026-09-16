import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Repository root: this file lives in scripts/. */
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Same order tsx and Next try when an import omits its extension. */
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".json"];

/**
 * Next.js build markers. They are not packages — Next substitutes them while
 * bundling, and they carry no runtime behaviour — so outside Next they resolve
 * to an empty module rather than failing to resolve at all.
 */
const BUILD_MARKERS = new Set(["server-only", "client-only"]);

const MARKER_FILE = path.join(ROOT, "scripts", "build-marker-module.cjs");

function resolveFile(candidate) {
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  for (const extension of EXTENSIONS) {
    const withExtension = candidate + extension;
    if (existsSync(withExtension)) return withExtension;
  }
  for (const extension of EXTENSIONS) {
    const indexed = path.join(candidate, `index${extension}`);
    if (existsSync(indexed)) return indexed;
  }
  return null;
}

/**
 * The project's own mapping, as a filename. Returns null for anything this
 * project does not claim, so normal resolution handles it.
 */
export function resolveProjectSpecifier(specifier) {
  if (BUILD_MARKERS.has(specifier)) return MARKER_FILE;
  if (specifier.startsWith("@/")) return resolveFile(path.join(ROOT, specifier.slice(2)));
  return null;
}

/** ESM side. The CommonJS side is patched in repo-alias-hook.mjs. */
export async function resolve(specifier, context, nextResolve) {
  const target = resolveProjectSpecifier(specifier);
  if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
