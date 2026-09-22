import type { ManufacturingOperation, OperationInputs } from "@/lib/instant-quote/domain";
import { operationLabels } from "@/lib/instant-quote/client-labels";

export function bendingQuantitySummary(operations: readonly ManufacturingOperation[], inputs: OperationInputs, measured: number | null, quantity: number): string | null {
  if (!operations.includes("bending")) return null;
  const count = inputs.bendCount ?? measured;
  if (count == null || !Number.isSafeInteger(count) || count <= 0) return "Гибка: укажите количество гибов на одну деталь.";
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(count * quantity)) return null;
  return `Гибка: ${count} гиб./деталь × ${quantity} шт. = ${count * quantity} гибов в партии.`;
}

/** Keeps selected processing and unknown customer inputs visible when controls are collapsed. */
export function ClientOperationSummary({ operations, operationInputs, detectedBendCount, quantity = 1 }: {
  operations: readonly ManufacturingOperation[];
  operationInputs: OperationInputs;
  detectedBendCount: number | null;
  quantity?: number;
}) {
  const bends = bendingQuantitySummary(operations, operationInputs, detectedBendCount, quantity);
  const missing = [
    operations.includes("bending") && operationInputs.bendCount == null && detectedBendCount == null ? "количество гибов" : null,
    operations.includes("welding") && !(operationInputs.weldLengthM && operationInputs.weldLengthM > 0) ? "длина шва" : null,
    operations.includes("countersink") && !(operationInputs.countersinkCount && operationInputs.countersinkCount > 0) ? "количество зенковок" : null,
    operations.includes("assembly") && operationInputs.assemblyMinutes == null ? "норма сборки" : null,
    operations.includes("powder-coating") && operationInputs.powderSides == null ? "стороны окраски" : null,
    operations.includes("surface-preparation") && operationInputs.surfacePreparationSides == null ? "стороны подготовки" : null,
  ].filter(Boolean);
  return <div>
    <p className="mt-3 text-xs leading-5 text-white/75"><span className="text-white/50">Состав: </span>{operationLabels([...operations]).join(" · ")}</p>
    {operations.includes("countersink") && (operationInputs.countersinkCount ?? 0) > 0 && <p className="mt-2 text-sm leading-5 text-white/85">Зенковка: {operationInputs.countersinkCount} на деталь × {quantity} шт. = {operationInputs.countersinkCount! * quantity} в партии.</p>}
    {operations.includes("welding") && (operationInputs.weldLengthM ?? 0) > 0 && <p className="mt-2 text-sm leading-5 text-white/85">Сварка: {operationInputs.weldLengthM} м/изделие × {quantity} шт. = {Number((operationInputs.weldLengthM! * quantity).toFixed(6))} м шва в партии.</p>}
    {bends && <p className="mt-2 text-sm leading-5 text-white/85">{bends}</p>}
    {missing.length > 0 && <p className="mt-2 text-xs leading-5 text-amber-200">Уточнит инженер: {missing.join(", ")}. Без исходных данных автоматическая цена не подтверждается.</p>}
  </div>;
}
