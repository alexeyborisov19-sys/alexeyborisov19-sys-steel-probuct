import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, relative, resolve, sep } from "node:path";

export const uploadLimits = {
  maximumFileBytes: 7 * 1024 * 1024,
  maximumTotalBytes: 10 * 1024 * 1024,
  maximumFiles: 10,
  maximumMultipartBytes: 11 * 1024 * 1024,
} as const;

const mimeByExtension: Record<string, Set<string>> = {
  pdf: new Set(["application/pdf", "application/octet-stream"]),
  png: new Set(["image/png", "application/octet-stream"]),
  jpg: new Set(["image/jpeg", "application/octet-stream"]),
  jpeg: new Set(["image/jpeg", "application/octet-stream"]),
  webp: new Set(["image/webp", "application/octet-stream"]),
  tif: new Set(["image/tiff", "application/octet-stream"]),
  tiff: new Set(["image/tiff", "application/octet-stream"]),
  zip: new Set(["application/zip", "application/x-zip-compressed", "application/octet-stream"]),
  rar: new Set(["application/vnd.rar", "application/x-rar-compressed", "application/octet-stream"]),
  "7z": new Set(["application/x-7z-compressed", "application/octet-stream"]),
  doc: new Set(["application/msword", "application/octet-stream"]),
  xls: new Set(["application/vnd.ms-excel", "application/octet-stream"]),
  docx: new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream"]),
  xlsx: new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"]),
};

const cadExtensions = new Set([
  "dxf", "dwg", "dwt", "dws", "step", "stp", "iges", "igs",
  "sldprt", "sldasm", "ipt", "iam", "idw",
]);

const archiveExtensions = new Set(["zip", "rar", "7z"]);
const supportedExtensions = new Set([
  ...Object.keys(mimeByExtension),
  ...cadExtensions,
]);

export type UploadSafety = "verified" | "unverified-cad" | "unverified-archive";
export type UploadInspection = {
  originalName: string;
  safeName: string;
  extension: string;
  browserMime: string;
  size: number;
  safety: UploadSafety;
  buffer: Buffer;
};

export type QuarantinedUpload = Omit<UploadInspection, "buffer"> & {
  storageId: string;
  antivirus: "clean" | "not-configured" | "blocked";
};

export class UploadValidationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function extensionOf(name: string) {
  return extname(name).slice(1).toLowerCase();
}

export function sanitizeUploadName(name: string) {
  const clean = basename(name)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._()\- ]/gu, "_")
    .replace(/\.+/g, ".")
    .replace(/\s+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return clean || "attachment";
}

function startsWith(buffer: Buffer, bytes: number[]) {
  return bytes.every((value, index) => buffer[index] === value);
}

function isZip(buffer: Buffer) {
  return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])
    || startsWith(buffer, [0x50, 0x4b, 0x05, 0x06])
    || startsWith(buffer, [0x50, 0x4b, 0x07, 0x08]);
}

function isCompoundOffice(buffer: Buffer) {
  return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

function containsZipMarker(buffer: Buffer, marker: string) {
  return buffer.includes(Buffer.from(marker, "utf8"));
}

function hasExpectedSignature(extension: string, buffer: Buffer) {
  switch (extension) {
    case "pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    case "png":
      return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg":
      return startsWith(buffer, [0xff, 0xd8, 0xff]);
    case "webp":
      return buffer.subarray(0, 4).toString("ascii") === "RIFF"
        && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    case "tif":
    case "tiff":
      return startsWith(buffer, [0x49, 0x49, 0x2a, 0x00])
        || startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a]);
    case "zip":
      return isZip(buffer);
    case "rar":
      return startsWith(buffer, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]);
    case "7z":
      return startsWith(buffer, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
    case "doc":
    case "xls":
      return isCompoundOffice(buffer);
    case "docx":
      return isZip(buffer)
        && containsZipMarker(buffer, "[Content_Types].xml")
        && containsZipMarker(buffer, "word/");
    case "xlsx":
      return isZip(buffer)
        && containsZipMarker(buffer, "[Content_Types].xml")
        && containsZipMarker(buffer, "xl/");
    default:
      return false;
  }
}

function plausibleCad(extension: string, buffer: Buffer) {
  const start = buffer.subarray(0, Math.min(buffer.length, 256)).toString("latin1").trimStart();
  if (extension === "dwg" || extension === "dwt" || extension === "dws") {
    return /^AC10\d{2}/.test(start);
  }
  if (extension === "dxf") return /^(0\s*[\r\n]+\s*SECTION|AutoCAD Binary DXF)/i.test(start);
  if (extension === "step" || extension === "stp") return start.includes("ISO-10303-21");
  if (extension === "iges" || extension === "igs") return buffer.length >= 80;
  return isZip(buffer) || isCompoundOffice(buffer);
}

export async function inspectUploads(files: File[], maximumFiles: number = uploadLimits.maximumFiles) {
  if (files.length > maximumFiles) {
    throw new UploadValidationError(`Можно прикрепить не более ${maximumFiles} файлов.`);
  }
  if (files.some((file) => file.size > uploadLimits.maximumFileBytes)) {
    throw new UploadValidationError("Размер каждого файла не должен превышать 7 МБ.", 413);
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > uploadLimits.maximumTotalBytes) {
    throw new UploadValidationError("Общий размер файлов не должен превышать 10 МБ.", 413);
  }

  const inspections: UploadInspection[] = [];
  for (const file of files) {
    const extension = extensionOf(file.name);
    if (!supportedExtensions.has(extension)) {
      throw new UploadValidationError("Один из файлов имеет неподдерживаемый формат.");
    }

    const browserMime = (file.type || "application/octet-stream").toLowerCase();
    const expectedMimes = mimeByExtension[extension];
    if (expectedMimes && !expectedMimes.has(browserMime)) {
      throw new UploadValidationError("Тип одного из файлов не соответствует его формату.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (cadExtensions.has(extension)) {
      if (!plausibleCad(extension, buffer)) {
        throw new UploadValidationError("Один из CAD-файлов не прошёл проверку формата.");
      }
      inspections.push({
        originalName: file.name,
        safeName: sanitizeUploadName(file.name),
        extension,
        browserMime,
        size: file.size,
        safety: "unverified-cad",
        buffer,
      });
      continue;
    }

    if (!hasExpectedSignature(extension, buffer)) {
      throw new UploadValidationError("Содержимое одного из файлов не соответствует его расширению.");
    }

    inspections.push({
      originalName: file.name,
      safeName: sanitizeUploadName(file.name),
      extension,
      browserMime,
      size: file.size,
      safety: archiveExtensions.has(extension) ? "unverified-archive" : "verified",
      buffer,
    });
  }
  return inspections;
}

function assertOutsidePublic(path: string) {
  const publicRoot = resolve(process.cwd(), "public");
  const pathFromPublic = relative(publicRoot, path);
  if (pathFromPublic === "" || (!pathFromPublic.startsWith(`..${sep}`) && pathFromPublic !== "..")) {
    throw new Error("Quarantine directory must be outside public");
  }
}

async function scanWithClamAv(path: string) {
  if (process.env.CLAMAV_ENABLED !== "true") return "not-configured" as const;
  const command = process.env.CLAMAV_COMMAND || "clamscan";

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, ["--no-summary", path], {
      stdio: "ignore",
      shell: false,
    });
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) rejectPromise(error);
      else resolvePromise();
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("Antivirus scan timed out"));
    }, 30_000);
    timeout.unref();

    child.once("error", (error) => finish(error));
    child.once("exit", (code) => {
      if (code === 0) finish();
      else finish(new Error("Antivirus rejected or could not scan an attachment"));
    });
  });
  return "clean" as const;
}

export async function quarantineUploads(requestId: string, uploads: UploadInspection[]) {
  const root = resolve(process.env.UPLOAD_QUARANTINE_PATH || ".data/quarantine");
  assertOutsidePublic(root);
  const requestDirectory = resolve(root, requestId);
  await mkdir(requestDirectory, { recursive: true, mode: 0o700 });

  const stored: QuarantinedUpload[] = [];
  for (const upload of uploads) {
    const storageId = `${randomUUID()}.${upload.extension}`;
    const target = resolve(requestDirectory, storageId);
    if (!target.startsWith(`${requestDirectory}${sep}`)) throw new Error("Unsafe quarantine path");
    await writeFile(target, upload.buffer, { mode: 0o600, flag: "wx" });
    let antivirus: QuarantinedUpload["antivirus"];
    try {
      antivirus = await scanWithClamAv(target);
    } catch {
      // Fail closed: keep the file in quarantine and do not disclose internal
      // scanner details or pass the file to a delivery channel.
      antivirus = "blocked";
    }
    stored.push({
      originalName: upload.originalName,
      safeName: upload.safeName,
      extension: upload.extension,
      browserMime: upload.browserMime,
      size: upload.size,
      safety: upload.safety,
      storageId,
      antivirus,
    });
  }
  return stored;
}
