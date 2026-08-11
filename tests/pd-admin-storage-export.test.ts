import assert from "node:assert/strict";
import { mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertMetadataExcludesFinalArchiveHash,
  assertSelectiveExportFilter,
  neutralizeSpreadsheetFormula,
} from "@/lib/pd-admin/export/policy";
import { evaluateDeletionCandidate } from "@/lib/pd-admin/retention/policy";
import {
  PdSafeFileError,
  readProtectedJson,
  requestIdPattern,
  resolveProtectedFile,
} from "@/lib/pd-admin/storage/safe-files";

test("requestId validation blocks path traversal and malformed identifiers", () => {
  assert.equal(requestIdPattern.test("SP-20260808-1234ABCD"), true);
  assert.equal(requestIdPattern.test("SP-AI-20260808-1234ABCD"), true);
  assert.equal(requestIdPattern.test("../../etc/passwd"), false);
  assert.equal(requestIdPattern.test("SP-20260808-1234abcd"), false);
});

test("realpath boundary and symlink checks keep protected reads inside the root", async () => {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-pd-files-"));
  const outside = join(root, "..", "outside-pd-test.json");
  await writeFile(outside, "{}", { mode: 0o600 });
  await writeFile(join(root, "safe.json"), "{}", { mode: 0o600 });
  await symlink(outside, join(root, "linked.json"));
  await assert.rejects(
    resolveProtectedFile(root, ["..", "outside-pd-test.json"]),
    (error: unknown) => error instanceof PdSafeFileError && error.reason === "UNSAFE_PATH",
  );
  await assert.rejects(
    resolveProtectedFile(root, ["linked.json"]),
    (error: unknown) => error instanceof PdSafeFileError && error.reason === "SYMLINK",
  );
  assert.equal(await resolveProtectedFile(root, ["safe.json"]), await realpath(join(root, "safe.json")));
});

test("bounded JSON reader rejects corrupt JSON without disclosing its path", async () => {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-pd-json-"));
  const requestId = "SP-20260808-1234ABCD";
  await writeFile(join(root, `${requestId}.json`), "{not-json", { mode: 0o600 });
  await assert.rejects(
    readProtectedJson(root, requestId),
    (error: unknown) => error instanceof PdSafeFileError
      && error.reason === "CORRUPT"
      && !error.message.includes(root),
  );
});

test("official export requires a bounded selector and excludes its final ZIP hash", () => {
  assert.throws(() => assertSelectiveExportFilter({}));
  assert.doesNotThrow(() => assertSelectiveExportFilter({ requestIds: ["SP-20260808-1234ABCD"] }));
  assert.doesNotThrow(() => assertSelectiveExportFilter({
    createdFrom: "2026-08-01T00:00:00.000Z",
    createdTo: "2026-08-31T23:59:59.000Z",
  }));
  assert.throws(() => assertSelectiveExportFilter({
    createdFrom: "2020-01-01T00:00:00.000Z",
    createdTo: "2026-08-31T23:59:59.000Z",
  }));

  const metadata = {
    operator: "ООО «ЭНЕРГОАЛЬЯНС»" as const,
    generatedAt: "2026-08-08T00:00:00.000Z",
    exportId: "export-1",
    legalBasis: "request",
    requestNumber: "1",
    requestedByUserId: "user-1",
    approvedByUserId: "user-2",
    filters: { requestIds: ["SP-20260808-1234ABCD"] },
    recordsCount: 1,
    dataCategories: ["lead"],
    attachmentsIncluded: false,
    archiveExpiresAt: "2026-08-09T00:00:00.000Z",
    manifestSha256: "a".repeat(64),
  };
  assert.doesNotThrow(() => assertMetadataExcludesFinalArchiveHash(metadata));
  assert.throws(() => assertMetadataExcludesFinalArchiveHash({ ...metadata, archiveSha256: "b".repeat(64) }));
});

test("spreadsheet cells neutralize formula injection", () => {
  for (const value of ["=CMD()", "+1+1", "-2+3", "@SUM(A1:A2)", "  =WEBSERVICE(\"x\")"]) {
    assert.equal(neutralizeSpreadsheetFormula(value).startsWith("'"), true);
  }
  assert.equal(neutralizeSpreadsheetFormula("Обычный технический текст"), "Обычный технический текст");
});

test("legal hold blocks deletion and consent has its independent retention", () => {
  const result = evaluateDeletionCandidate({
    requestId: "SP-20260808-1234ABCD",
    expiresAt: "2026-01-01T00:00:00.000Z",
    consentExpiresAt: "2027-01-01T00:00:00.000Z",
    blockers: {
      legalHold: true,
      openSubjectRequest: false,
      governmentRequest: false,
      courtBasis: false,
      openIncident: false,
      activeExport: false,
      contractualBasis: false,
      retentionOverride: false,
      backupRequiredButMissing: false,
    },
  }, new Date("2026-08-08T00:00:00.000Z"));
  assert.equal(result.eligible, false);
  assert.equal(result.preserveConsentAudit, true);
  assert.deepEqual(result.blockerCodes, ["legalHold"]);
});
