import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const auditSource = readFileSync(join(process.cwd(), "scripts/audit-seo.mjs"), "utf8");

test("SEO image audit unwraps local Next Image sources but skips remote optimizer dependencies", () => {
  const functionStart = auditSource.indexOf("function imagePathForAudit(src) {");
  const functionEnd = auditSource.indexOf("\n}\n\nfunction internalLink", functionStart);
  assert.ok(functionStart >= 0, "imagePathForAudit helper must exist");
  assert.ok(functionEnd > functionStart, "imagePathForAudit helper body must be readable");

  const helperBody = auditSource.slice(functionStart, functionEnd);
  assert.ok(helperBody.includes('if (sourcePath?.startsWith("/")) return sourcePath;'));
  assert.ok(helperBody.includes("return null;"));
  assert.ok(auditSource.includes("const sourcePath = imagePathForAudit(src);"));
  assert.ok(auditSource.includes("if (sourcePath) imagePaths.add(sourcePath);"));
  assert.doesNotMatch(auditSource, /imagePaths\.add\(imagePathForAudit\(src\)\)/);
});
