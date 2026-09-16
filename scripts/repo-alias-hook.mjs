/**
 * Resolves the project's own imports for code run outside Next.js.
 *
 * Two things need mapping. The "@/..." alias, which Next resolves from
 * tsconfig and a plain node process does not know about. And Next's build
 * markers, "server-only" and "client-only", which are not packages at all —
 * Next substitutes them while bundling, they are in neither the manifest nor
 * the lockfile, and they carry no runtime behaviour.
 *
 * Both sides have to be covered. The project declares no module type, so tsx
 * transpiles its TypeScript to CommonJS: an `import` inside those files becomes
 * a `require`, which module.register() hooks never see. Registering only the
 * ESM hook got the entry module loaded and then died on the first `require`
 * inside it.
 *
 * Deliberately not a dependency: the mapping is small, and the price refresh
 * must not gain a package in order to start.
 */
import Module from "node:module";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { resolveProjectSpecifier } from "./repo-alias-resolver.mjs";

// ESM side: dynamic import() of the project's own modules.
register(
  new URL("./repo-alias-resolver.mjs", import.meta.url),
  pathToFileURL("./"),
);

// CommonJS side: every import inside the transpiled TypeScript.
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...rest) {
  const target = resolveProjectSpecifier(request);
  if (target) return target;
  return originalResolveFilename.call(this, request, ...rest);
};
