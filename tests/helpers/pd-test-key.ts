import { createHash } from "node:crypto";

export function pdTestKey(purpose: string): string {
  return createHash("sha256")
    .update(`steelprodukt-pd-test-key:${purpose}`)
    .digest("hex");
}
