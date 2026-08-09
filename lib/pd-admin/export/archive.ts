import { createHash } from "node:crypto";
import { neutralizeSpreadsheetFormula } from "@/lib/pd-admin/export/policy";

export type ZipEntry = { path: string; content: Buffer; modifiedAt?: Date };

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

export function crc32(buffer: Buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function safeZipPath(path: string) {
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Unsafe ZIP path");
  }
  return path;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2),
  };
}

export function createStoredZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = []; const centralParts: Buffer[] = []; let offset = 0;
  const seen = new Set<string>();
  for (const entry of entries) {
    const path = safeZipPath(entry.path.normalize("NFC")); if (seen.has(path)) throw new Error("Duplicate ZIP entry"); seen.add(path);
    const name = Buffer.from(path, "utf8"); const content = entry.content; const checksum = crc32(content); const timestamp = dosDateTime(entry.modifiedAt ?? new Date());
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(timestamp.time, 10); local.writeUInt16LE(timestamp.date, 12); local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(content.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    localParts.push(local, name, content);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10); central.writeUInt16LE(timestamp.time, 12); central.writeUInt16LE(timestamp.date, 14); central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(content.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42); centralParts.push(central, name);
    offset += local.length + name.length + content.length;
  }
  const centralDirectory = Buffer.concat(centralParts); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralDirectory.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function sha256Buffer(content: Buffer | string) {
  return createHash("sha256").update(content).digest("hex");
}

function xml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let result = ""; let value = index + 1;
  while (value) { const remainder = (value - 1) % 26; result = String.fromCharCode(65 + remainder) + result; value = Math.floor((value - 1) / 26); }
  return result;
}

function worksheetXml(rows: unknown[][]) {
  const body = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
    const safe = neutralizeSpreadsheetFormula(String(value ?? ""));
    return `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr" s="${rowIndex === 0 ? 1 : 0}"><is><t xml:space="preserve">${xml(safe)}</t></is></c>`;
  }).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${Array.from({ length: Math.max(1, ...rows.map((row) => row.length)) }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="24" customWidth="1"/>`).join("")}</cols><sheetData>${body}</sheetData><autoFilter ref="A1:${columnName(Math.max(0, (rows[0]?.length ?? 1) - 1))}${Math.max(1, rows.length)}"/></worksheet>`;
}

export function createXlsx(sheets: Array<{ name: string; rows: unknown[][] }>) {
  const safeSheets = sheets.map((sheet, index) => ({ ...sheet, name: sheet.name.replace(/[\\/*?:\[\]]/g, "_").slice(0, 31) || `Лист ${index + 1}` }));
  const workbookSheets = safeSheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const rels = safeSheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const overrides = safeSheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const entries: ZipEntry[] = [
    { path: "[Content_Types].xml", content: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`) },
    { path: "_rels/.rels", content: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { path: "xl/workbook.xml", content: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`) },
    { path: "xl/_rels/workbook.xml.rels", content: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { path: "xl/styles.xml", content: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>`) },
    ...safeSheets.map((sheet, index) => ({ path: `xl/worksheets/sheet${index + 1}.xml`, content: Buffer.from(worksheetXml(sheet.rows)) })),
  ];
  return createStoredZip(entries);
}

export function createCsv(headers: string[], rows: unknown[][]) {
  const encode = (value: unknown) => `"${neutralizeSpreadsheetFormula(String(value ?? "")).replaceAll('"', '""')}"`;
  return Buffer.from(`\ufeff${[headers, ...rows].map((row) => row.map(encode).join(";")).join("\r\n")}\r\n`, "utf8");
}

export function createDocx(paragraphs: string[]) {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map((paragraph, index) => `<w:p><w:pPr>${index === 0 ? "<w:jc w:val=\"center\"/>" : ""}</w:pPr><w:r><w:rPr>${index === 0 ? "<w:b/><w:sz w:val=\"28\"/>" : "<w:sz w:val=\"22\"/>"}</w:rPr><w:t xml:space="preserve">${xml(paragraph)}</w:t></w:r></w:p>`).join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  return createStoredZip([
    { path: "[Content_Types].xml", content: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`) },
    { path: "_rels/.rels", content: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
    { path: "word/document.xml", content: Buffer.from(document) },
  ]);
}
