import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auditSource = readFileSync(new URL("../scripts/audit-seo.mjs", import.meta.url), "utf8");

test("SEO image audit unwraps local Next Image sources but skips remote optimizer dependencies", () => {
  assert.match(
    auditSource,
    /if \(sourcePath\?\.startsWith\("\/"\)\) return sourcePath;[\s\S]*?return null;/,
  );
  assert.match(
    auditSource,
    /const sourcePath = imagePathForAudit\(src\);\s*if \(sourcePath\) imagePaths\.add\(sourcePath\);/,
  );
  assert.doesNotMatch(auditSource, /imagePaths\.add\(imagePathForAudit\(src\)\)/);
});
