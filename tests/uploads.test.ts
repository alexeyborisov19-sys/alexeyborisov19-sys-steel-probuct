import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  inspectUploads,
  quarantineUploads,
  UploadValidationError,
} from "@/lib/security/uploads";

function file(bytes: number[], name: string, type: string) {
  return new File([new Uint8Array(bytes)], name, { type });
}

test("rejects an executable renamed to PDF", async () => {
  await assert.rejects(
    inspectUploads([file([0x4d, 0x5a, 0x90, 0x00], "drawing.pdf", "application/pdf")]),
    UploadValidationError,
  );
});

test("rejects a fake PNG", async () => {
  await assert.rejects(
    inspectUploads([file([0x74, 0x65, 0x78, 0x74], "image.png", "image/png")]),
    UploadValidationError,
  );
});

test("rejects a browser MIME that conflicts with the extension", async () => {
  await assert.rejects(
    inspectUploads([file([0x25, 0x50, 0x44, 0x46, 0x2d], "drawing.pdf", "image/png")]),
    UploadValidationError,
  );
});

test("accepts a ZIP only as an unverified archive", async () => {
  const [inspection] = await inspectUploads([
    file([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0], "drawings.zip", "application/zip"),
  ]);
  assert.equal(inspection.safety, "unverified-archive");
});

test("enforces maximum size before reading file content", async () => {
  const large = new File([new Uint8Array(7 * 1024 * 1024 + 1)], "large.pdf", {
    type: "application/pdf",
  });
  await assert.rejects(
    inspectUploads([large]),
    (error: unknown) => error instanceof UploadValidationError && error.status === 413,
  );
});

test("quarantine uses private file and directory permissions", async () => {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-quarantine-"));
  process.env.UPLOAD_QUARANTINE_PATH = root;
  const uploads = await inspectUploads([
    file([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], "drawing.pdf", "application/pdf"),
  ]);
  const [stored] = await quarantineUploads("SP-TEST", uploads);
  const directoryMode = (await stat(join(root, "SP-TEST"))).mode & 0o777;
  const fileMode = (await stat(join(root, "SP-TEST", stored.storageId))).mode & 0o777;
  assert.equal(directoryMode, 0o700);
  assert.equal(fileMode, 0o600);
  assert.equal("path" in stored, false);
  delete process.env.UPLOAD_QUARANTINE_PATH;
});

test("unavailable antivirus fails closed and leaves the file blocked in quarantine", async () => {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-clamav-"));
  const previousRoot = process.env.UPLOAD_QUARANTINE_PATH;
  const previousEnabled = process.env.CLAMAV_ENABLED;
  const previousCommand = process.env.CLAMAV_COMMAND;
  process.env.UPLOAD_QUARANTINE_PATH = root;
  process.env.CLAMAV_ENABLED = "true";
  process.env.CLAMAV_COMMAND = "steelprodukt-clamav-command-that-does-not-exist";
  try {
    const uploads = await inspectUploads([
      file([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], "drawing.pdf", "application/pdf"),
    ]);
    const [stored] = await quarantineUploads("SP-ANTIVIRUS-TEST", uploads);
    assert.equal(stored.antivirus, "blocked");
  } finally {
    if (previousRoot === undefined) delete process.env.UPLOAD_QUARANTINE_PATH;
    else process.env.UPLOAD_QUARANTINE_PATH = previousRoot;
    if (previousEnabled === undefined) delete process.env.CLAMAV_ENABLED;
    else process.env.CLAMAV_ENABLED = previousEnabled;
    if (previousCommand === undefined) delete process.env.CLAMAV_COMMAND;
    else process.env.CLAMAV_COMMAND = previousCommand;
  }
});
