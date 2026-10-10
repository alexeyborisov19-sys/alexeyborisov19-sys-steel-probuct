import { PRODUCT_CALCULATION_NOTICE } from "../product-calculation-notice";
import { createEmptyProject, normalizeCadFormat, type InstantQuoteProject, type ManufacturingOperation, type OperationInputs, type PartConfiguration } from './domain';
import { createManualSheetDxf, manualHoleGroups, readManualSheetDxf, validateManualSheet, type ManualSheetInput } from './manual-sheet';
import { addPartToProject } from './project';

export const MAX_PROJECT_FILE_BYTES = 64 * 1024;
const MAX_CAD_FILE_BYTES = 50 * 1024 * 1024;
const MAX_CAD_PROJECT_BYTES = 100 * 1024 * 1024;
const OPERATIONS: ManufacturingOperation[] = ['laser-cutting', 'bending', 'welding', 'countersink', 'assembly', 'surface-preparation', 'powder-coating', 'packaging'];
const INPUT_LIMITS = { bendCount: 500, countersinkCount: 100_000, weldLengthM: 500, assemblyMinutes: 10_000, powderSides: 2, surfacePreparationSides: 2 } as const;
export type CadAttachmentManifest = { fileName: string; sizeBytes: number; lastModified: number; sha256: string };
export type CadProjectSource = { kind: 'manual'; fileName: string; input: ManualSheetInput } | { kind: 'cad'; attachment: CadAttachmentManifest };
export type CadProjectFile = {
  notice?: string;
  format: 'steel-product-cad-project'; schemaVersion: 1; title: string; revision: number; savedAt: string; activePosition: number;
  positions: { configuration: PartConfiguration; source: CadProjectSource }[];
};

function invalid(message = 'Файл проекта повреждён или содержит неподдерживаемые параметры.'): never { throw new Error(message); }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, fileName = false): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value) || (fileName && /[/\\]/.test(value))) invalid();
  return value;
}
function number(value: unknown, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) invalid();
  return value;
}
function fileName(value: unknown): string {
  const name = text(value, 255, true);
  if (!normalizeCadFormat(name)) invalid('В проекте указан неподдерживаемый формат исходного файла.');
  return name;
}
function configuration(value: unknown): PartConfiguration {
  const item = object(value, ['materialId', 'thicknessMm', 'quantity', 'operations', 'operationInputs']);
  if (!['hot', 'cold', 'zinc'].includes(item.materialId as string)) invalid('В проекте указан недоступный материал.');
  if (!Array.isArray(item.operations) || item.operations.length > OPERATIONS.length || item.operations.some(op => !OPERATIONS.includes(op)) || new Set(item.operations).size !== item.operations.length) invalid();
  const rawInputs = object(item.operationInputs ?? {}, Object.keys(INPUT_LIMITS));
  const inputs: OperationInputs = {};
  for (const key of Object.keys(INPUT_LIMITS) as (keyof OperationInputs)[]) {
    if (!Object.hasOwn(rawInputs, key)) continue;
    const sides = key === 'powderSides' || key === 'surfacePreparationSides';
    const integer = sides || key === 'bendCount' || key === 'countersinkCount';
    const parsed = number(rawInputs[key], sides ? 1 : 0, INPUT_LIMITS[key], integer);
    Object.assign(inputs, { [key]: parsed });
  }
  return { materialId: item.materialId as string, thicknessMm: number(item.thicknessMm, Number.MIN_VALUE, 100), quantity: number(item.quantity, 1, 100_000, true), operations: [...item.operations], operationInputs: inputs };
}
function source(value: unknown): CadProjectSource {
  const item = object(value, ['kind', 'fileName', 'input', 'attachment']);
  if (item.kind === 'manual') {
    object(item, ['kind', 'fileName', 'input']);
    const name = fileName(item.fileName);
    if (normalizeCadFormat(name) !== 'dxf') invalid();
    const input = validateManualSheet(item.input);
    // Storage safety bounds, not manufacturing capabilities. The server still
    // evaluates the actual supported envelope and all engineering constraints.
    number(input.lengthMm, Number.MIN_VALUE, 1_000_000);
    number(input.widthMm, Number.MIN_VALUE, 1_000_000);
    for (const group of manualHoleGroups(input)) { number(group.count, 1, 1_000_000_000, true); number(group.diameterMm, Number.MIN_VALUE, 1_000_000); }
    return { kind: 'manual', fileName: name, input };
  }
  if (item.kind !== 'cad') invalid();
  object(item, ['kind', 'attachment']);
  const attachment = object(item.attachment, ['fileName', 'sizeBytes', 'lastModified', 'sha256']);
  if (typeof attachment.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(attachment.sha256)) invalid('В проекте отсутствует контрольная сумма исходного CAD.');
  return { kind: 'cad', attachment: { fileName: fileName(attachment.fileName), sizeBytes: number(attachment.sizeBytes, 1, MAX_CAD_FILE_BYTES, true), lastModified: number(attachment.lastModified, 0, Number.MAX_SAFE_INTEGER, true), sha256: attachment.sha256 } };
}
function validate(value: unknown): CadProjectFile {
  const root = object(value, ['format', 'schemaVersion', 'title', 'revision', 'savedAt', 'activePosition', 'positions', 'notice']);
  if (root.format !== 'steel-product-cad-project') invalid('Это не файл проекта CAD-калькулятора Сталь-Продукт.');
  if (root.notice !== undefined && root.notice !== PRODUCT_CALCULATION_NOTICE) invalid('Статус проекта не поддерживается.');
  if (root.schemaVersion !== 1) invalid('Эта версия файла проекта не поддерживается. Текущий проект не изменён.');
  if (!Array.isArray(root.positions) || root.positions.length < 1 || root.positions.length > 5) invalid('В проекте должно быть от 1 до 5 позиций.');
  const savedAt = text(root.savedAt, 30);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(savedAt) || !Number.isFinite(Date.parse(savedAt))) invalid();
  const positions = root.positions.map(value => {
    const position = object(value, ['configuration', 'source']);
    return { configuration: configuration(position.configuration), source: source(position.source) };
  });
  const totalBytes = positions.reduce((sum, position) => sum + (position.source.kind === 'cad' ? position.source.attachment.sizeBytes : new TextEncoder().encode(createManualSheetDxf(position.source.input)).byteLength), 0);
  if (totalBytes > MAX_CAD_PROJECT_BYTES) invalid('Исходные файлы проекта превышают общий лимит 100 МБ.');
  return { notice: PRODUCT_CALCULATION_NOTICE, format: 'steel-product-cad-project', schemaVersion: 1, title: text(root.title, 120), revision: number(root.revision, 1, 1_000_000_000, true), savedAt, activePosition: number(root.activePosition, 0, positions.length - 1, true), positions };
}

export function parseCadProjectFile(raw: string): CadProjectFile {
  if (raw.length > MAX_PROJECT_FILE_BYTES || new TextEncoder().encode(raw).byteLength > MAX_PROJECT_FILE_BYTES) invalid('Файл проекта превышает лимит 64 КБ. Исходные CAD прикрепляются отдельно.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { invalid('Не удалось прочитать JSON проекта. Текущий проект не изменён.'); }
  return validate(value);
}

async function digest(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) invalid('Браузер не поддерживает проверку SHA-256. Откройте калькулятор по HTTPS в современном браузере.');
  if (file.size < 1 || file.size > MAX_CAD_FILE_BYTES) invalid('Допустимый размер исходного CAD: до 50 МБ.');
  const hash = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Metadata helps the user find the file; only the digest checks its bytes.
 * Neither the manifest nor a matching digest is authoritative geometry. */
export async function verifyCadAttachment(file: File, expected: CadAttachmentManifest): Promise<void> {
  if (file.name !== expected.fileName || file.size !== expected.sizeBytes) invalid('Имя или размер не совпадают с исходным файлом этой позиции. Выберите оригинал; изменённую модель добавьте отдельной позицией.');
  if (await digest(file) !== expected.sha256) invalid('Содержимое CAD отличается от сохранённого исходника. Выберите оригинал; изменённую модель добавьте отдельной позицией.');
}

/** Explicit user-owned download only. No source bytes, previews, costs or
 * calculation authority are serialized, even if present on live objects. */
export async function createCadProjectFile(project: InstantQuoteProject, files: Record<string, File>, knownSources: Record<string, CadProjectSource>, revision: number): Promise<CadProjectFile> {
  const positions: CadProjectFile['positions'] = [];
  for (const part of project.parts) {
    const file = files[part.id];
    let partSource = knownSources[part.id];
    if (file) {
      const header = normalizeCadFormat(file.name) === 'dxf' ? await file.slice(0, 128).text() : '';
      const manual = header.startsWith('999\nSTEEL_PRODUCT_MANUAL_BLANK_') || header.startsWith('999\r\nSTEEL_PRODUCT_MANUAL_BLANK_');
      if (manual) {
        if (file.size > MAX_PROJECT_FILE_BYTES) invalid('Ручная заготовка слишком велика для файла проекта.');
        const input = readManualSheetDxf(await file.text());
        if (!input) invalid();
        partSource = { kind: 'manual', fileName: file.name, input };
      } else {
        partSource = { kind: 'cad', attachment: { fileName: file.name, sizeBytes: file.size, lastModified: file.lastModified, sha256: await digest(file) } };
      }
    }
    if (!partSource) invalid('Исходный файл отсутствует: сохранение проекта пока недоступно.');
    const c = part.configuration;
    const inputs: OperationInputs = {};
    for (const key of Object.keys(INPUT_LIMITS) as (keyof OperationInputs)[]) if (c.operationInputs?.[key] != null) Object.assign(inputs, { [key]: c.operationInputs[key] });
    positions.push({ source: partSource, configuration: { materialId: c.materialId, thicknessMm: c.thicknessMm, quantity: c.quantity, operations: [...c.operations], operationInputs: inputs } });
  }
  return validate({ format: 'steel-product-cad-project', schemaVersion: 1, title: project.title, revision, savedAt: new Date().toISOString(), activePosition: Math.max(0, project.parts.findIndex(part => part.id === project.activePartId)), positions });
}

/** Prepare and validate everything before the caller replaces live state.
 * Only user-declared manual dimensions can regenerate a file. All CAD waits
 * for explicit reattachment, and every source goes through the existing server. */
export function prepareCadProjectRestore(value: CadProjectFile) {
  const saved = validate(value);
  let project = createEmptyProject();
  project.id = `project-${globalThis.crypto.randomUUID()}`;
  project.title = saved.title;
  const filesByPartId: Record<string, File> = {};
  const sourcesByPartId: Record<string, CadProjectSource> = {};
  for (const [index, position] of saved.positions.entries()) {
    const source = position.source;
    const file = source.kind === 'manual' ? new File([createManualSheetDxf(source.input)], source.fileName, { type: 'application/dxf' }) : null;
    project = addPartToProject(project, { fileName: file?.name ?? (source.kind === 'cad' ? source.attachment.fileName : source.fileName), fileSizeBytes: file?.size ?? (source.kind === 'cad' ? source.attachment.sizeBytes : 0) });
    const part = project.parts[index];
    part.configuration = position.configuration;
    sourcesByPartId[part.id] = source;
    if (file) filesByPartId[part.id] = file;
  }
  project.activePartId = project.parts[saved.activePosition].id;
  return { project, filesByPartId, sourcesByPartId, revision: saved.revision };
}
