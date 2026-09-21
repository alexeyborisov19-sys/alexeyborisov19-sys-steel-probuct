import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export type MarketRegistryRead = {
  status: "loaded" | "not-configured" | "unavailable";
  data: unknown;
};

/** Paths and credentials are never accepted from an HTTP request. */
export async function readPrivateMarketRegistry(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<MarketRegistryRead> {
  const unavailable: MarketRegistryRead = { status: "unavailable", data: null };
  const path = environment.STEEL_PRODUCT_MARKET_REFERENCE_FILE?.trim();
  if (!path) return { status: "not-configured", data: null };
  if (!isAbsolute(path) || !path.endsWith(".json")) return unavailable;
  try {
    const resolved = await realpath(path);
    const fromProject = relative(process.cwd(), resolved);
    if (resolved !== resolve(path) || isAbsolute(fromProject)
      || !(fromProject === ".." || fromProject.startsWith(`..${sep}`))) return unavailable;
    const handle = await open(resolved, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const limit = 1_048_576;
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > limit || (stat.mode & 0o007) !== 0) return unavailable;
      const buffer = Buffer.alloc(limit + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > limit) return unavailable;
      return { status: "loaded", data: JSON.parse(buffer.subarray(0, length).toString("utf8")) };
    } finally { await handle.close(); }
  } catch { return unavailable; }
}
