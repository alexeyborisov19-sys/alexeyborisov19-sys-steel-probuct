import type { ManufacturingOperation, OperationInputs } from "@/lib/instant-quote/domain";
import type { MaterialId } from "@/lib/instant-quote/pricing";

/**
 * Physical quantities the customer declares for the operations they selected.
 * A CAD file cannot supply them: a DXF carries no bend count, no weld length
 * and no coating-side choice, so without these the matching cost articles stay
 * incomplete. They are customer specification, never rates, and an engineer
 * confirms them before production.
 */
export type PublicOperationInputs = OperationInputs;

export type PublicCalculationPartManifest = {
  clientPartId: string;
  fileIndex: number;
  materialId: MaterialId;
  thicknessMm: number;
  quantity: number;
  operations: ManufacturingOperation[];
  operationInputs: PublicOperationInputs;
};

export type PublicCalculationManifest = {
  title: string;
  parts: PublicCalculationPartManifest[];
};

const PUBLIC_MATERIALS = new Set<MaterialId>(["hot", "cold", "zinc"]);
const PUBLIC_OPERATIONS = new Set<ManufacturingOperation>([
  "bending",
  "welding",
  "assembly",
  "surface-preparation",
  "powder-coating",
  "packaging",
]);

export class CalculationManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculationManifestError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CalculationManifestError(`${label}: неверный формат.`);
  return value as Record<string, unknown>;
}

function cleanText(value: unknown, label: string, max: number) {
  if (typeof value !== "string") throw new CalculationManifestError(`${label}: ожидается строка.`);
  const result = value.trim().replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").slice(0, max);
  if (!result) throw new CalculationManifestError(`${label}: значение обязательно.`);
  return result;
}

function finiteNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new CalculationManifestError(`${label}: ожидается число.`);
  return value;
}

function boundedNumber(value: unknown, label: string, max: number, integer: boolean) {
  const parsed = finiteNumber(value, label);
  if (integer && !Number.isInteger(parsed)) throw new CalculationManifestError(`${label}: ожидается целое число.`);
  if (parsed < 0 || parsed > max) throw new CalculationManifestError(`${label}: значение вне допустимого диапазона.`);
  return parsed;
}

/**
 * Keeps only the quantities whose operation the customer actually selected, so
 * a stale value left in the browser cannot reach a cost article that is not
 * part of this request.
 */
function operationInputs(
  value: unknown,
  label: string,
  operations: Set<ManufacturingOperation>,
): PublicOperationInputs {
  if (value == null) return {};
  const item = record(value, label);
  const result: PublicOperationInputs = {};

  if (item.bendCount != null && operations.has("bending")) {
    result.bendCount = boundedNumber(item.bendCount, `${label}.bendCount`, 500, true);
  }
  if (item.weldLengthM != null && operations.has("welding")) {
    result.weldLengthM = boundedNumber(item.weldLengthM, `${label}.weldLengthM`, 500, false);
  }
  if (item.assemblyMinutes != null && operations.has("assembly")) {
    result.assemblyMinutes = boundedNumber(item.assemblyMinutes, `${label}.assemblyMinutes`, 10_000, false);
  }
  if (item.powderSides != null && operations.has("powder-coating")) {
    const sides = boundedNumber(item.powderSides, `${label}.powderSides`, 2, true);
    if (sides !== 1 && sides !== 2) throw new CalculationManifestError(`${label}.powderSides: допустимы только 1 или 2.`);
    result.powderSides = sides;
  }

  return result;
}

export function parsePublicCalculationManifest(raw: string, fileCount: number): PublicCalculationManifest {
  if (!raw || raw.length > 40_000) throw new CalculationManifestError("Manifest отсутствует или слишком велик.");
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw) as unknown;
  } catch {
    throw new CalculationManifestError("Manifest не является корректным JSON.");
  }

  const root = record(decoded, "manifest");
  const title = typeof root.title === "string" && root.title.trim()
    ? cleanText(root.title, "title", 120)
    : "Производственный проект";
  if (!Array.isArray(root.parts) || root.parts.length === 0 || root.parts.length > 10) {
    throw new CalculationManifestError("Проект должен содержать от 1 до 10 позиций.");
  }
  if (fileCount !== root.parts.length) throw new CalculationManifestError("Количество CAD-файлов не совпадает с количеством позиций.");

  const ids = new Set<string>();
  const fileIndexes = new Set<number>();
  const parts = root.parts.map<PublicCalculationPartManifest>((value, index) => {
    const item = record(value, `parts[${index}]`);
    const clientPartId = cleanText(item.clientPartId, `parts[${index}].clientPartId`, 80);
    if (!/^[A-Za-z0-9._:-]+$/.test(clientPartId)) throw new CalculationManifestError(`parts[${index}].clientPartId: недопустимые символы.`);
    if (ids.has(clientPartId)) throw new CalculationManifestError("Идентификаторы позиций должны быть уникальны.");
    ids.add(clientPartId);

    const fileIndex = finiteNumber(item.fileIndex, `parts[${index}].fileIndex`);
    if (!Number.isInteger(fileIndex) || fileIndex < 0 || fileIndex >= fileCount) throw new CalculationManifestError(`parts[${index}].fileIndex: неверный индекс файла.`);
    if (fileIndexes.has(fileIndex)) throw new CalculationManifestError("Один CAD-файл нельзя использовать для двух позиций одного расчёта.");
    fileIndexes.add(fileIndex);

    const materialId = item.materialId;
    if (typeof materialId !== "string" || !PUBLIC_MATERIALS.has(materialId as MaterialId)) {
      throw new CalculationManifestError(`parts[${index}].materialId: материал недоступен в публичном конфигураторе.`);
    }

    const thicknessMm = finiteNumber(item.thicknessMm, `parts[${index}].thicknessMm`);
    if (!(thicknessMm > 0 && thicknessMm <= 100)) throw new CalculationManifestError(`parts[${index}].thicknessMm: неверная толщина.`);

    const quantity = finiteNumber(item.quantity, `parts[${index}].quantity`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) throw new CalculationManifestError(`parts[${index}].quantity: неверное количество.`);

    if (!Array.isArray(item.operations)) throw new CalculationManifestError(`parts[${index}].operations: ожидается массив.`);
    const operationSet = new Set<ManufacturingOperation>();
    for (const operation of item.operations) {
      if (typeof operation !== "string" || !PUBLIC_OPERATIONS.has(operation as ManufacturingOperation)) {
        throw new CalculationManifestError(`parts[${index}].operations: неподдерживаемая операция.`);
      }
      operationSet.add(operation as ManufacturingOperation);
    }

    // Laser cutting is the base sheet route and is server-added rather than trusted from the client.
    return {
      clientPartId,
      fileIndex,
      materialId: materialId as MaterialId,
      thicknessMm,
      quantity,
      operations: ["laser-cutting", ...operationSet],
      operationInputs: operationInputs(item.operationInputs, `parts[${index}].operationInputs`, operationSet),
    };
  });

  return { title, parts };
}
