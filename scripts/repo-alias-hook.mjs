/**
 * Resolves the project's "@/..." alias for code run outside Next.js.
 *
 * The server modules import each other through that alias, and Next resolves it
 * from tsconfig when it builds the site. A plain node process has no such
 * knowledge, so the price refresh — which runs from a systemd timer, not from a
 * request — needs the same mapping stated explicitly.
 *
 * Deliberately not a dependency: the mapping is three lines, and the timer must
 * not gain a package to start.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(
  new URL("./repo-alias-resolver.mjs", import.meta.url),
  pathToFileURL("./"),
);
