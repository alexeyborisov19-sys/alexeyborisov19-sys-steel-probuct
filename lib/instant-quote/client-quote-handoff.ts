import type { InstantQuoteProject, ProjectPart } from "@/lib/instant-quote/domain";
import { materialLabel, OPERATION_LABELS } from "@/lib/instant-quote/client-labels";

type CalculatorHandoff = { files: File[]; summary: string };
type StoredHandoff = CalculatorHandoff & { expiresAt: number };

const HANDOFF_LIFETIME_MS = 30 * 60 * 1000;
// Only this page's JS memory: a reload or a new tab must ask for files again.
// Neither File contents nor customer settings are persisted or sent here.
const handoffs = new Map<string, StoredHandoff>();

function removeExpiredHandoffs() {
  const now = Date.now();
  for (const [projectId, handoff] of handoffs) {
    if (handoff.expiresAt <= now) handoffs.delete(projectId);
  }
}

function number(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? String(value).replace(".", ",")
    : null;
}

function partSummary(part: ProjectPart, index: number, hasFile: boolean) {
  const { configuration } = part;
  const operations = configuration.operations.filter((operation) => Object.hasOwn(OPERATION_LABELS, operation));
  const inputs = configuration.operationInputs ?? {};
  const details: string[] = [];
  if (operations.includes("bending") && number(inputs.bendCount)) details.push(`гибов — ${number(inputs.bendCount)}`);
  if (operations.includes("welding") && number(inputs.weldLengthM)) details.push(`длина сварки — ${number(inputs.weldLengthM)} м`);
  if (operations.includes("assembly") && number(inputs.assemblyMinutes)) details.push(`сборка — ${number(inputs.assemblyMinutes)} мин`);
  if (operations.includes("powder-coating") && (inputs.powderSides === 1 || inputs.powderSides === 2)) details.push(`сторон окраски — ${inputs.powderSides}`);
  if (operations.includes("surface-preparation") && (inputs.surfacePreparationSides === 1 || inputs.surfacePreparationSides === 2)) details.push(`сторон подготовки поверхности — ${inputs.surfacePreparationSides}`);
  const material = ["hot", "cold", "zinc"].includes(configuration.materialId ?? "")
    ? materialLabel(configuration.materialId)
    : "не выбран";
  const thickness = number(configuration.thicknessMm);
  const quantity = number(configuration.quantity);
  // File names remain text and cannot insert extra lines into the summary.
  const fileName = part.fileName.replace(/[\r\n\t]/g, " ").slice(0, 255);

  return [
    `${index + 1}. Файл: ${fileName}`,
    `Материал: ${material}; толщина: ${thickness ? `${thickness} мм` : "не указана"}; количество: ${quantity ? `${quantity} шт` : "не указано"}.`,
    `Операции: ${operations.length ? operations.map((operation) => OPERATION_LABELS[operation]).join(", ") : "не выбраны"}.`,
    details.length ? `Параметры операций: ${details.join("; ")}.` : "",
    hasFile ? "" : "CAD-файл необходимо приложить повторно.",
  ].filter(Boolean).join("\n");
}

export function saveCalculatorHandoff(project: InstantQuoteProject, filesByPartId: Record<string, File>): void {
  removeExpiredHandoffs();
  const files: File[] = [];
  const summary = project.parts.map((part, index) => {
    const file = filesByPartId[part.id];
    if (file) files.push(file);
    return partSummary(part, index, Boolean(file));
  }).join("\n\n");
  handoffs.set(project.id, { files, summary, expiresAt: Date.now() + HANDOFF_LIFETIME_MS });
}

export function readCalculatorHandoff(projectId: string): CalculatorHandoff | null {
  removeExpiredHandoffs();
  const handoff = handoffs.get(projectId);
  return handoff ? { files: [...handoff.files], summary: handoff.summary } : null;
}

export function clearCalculatorHandoff(projectId: string): void {
  handoffs.delete(projectId);
}
