import type { ManufacturingOperation, OperationInputs } from "@/lib/instant-quote/domain";
import { operationLabels } from "@/lib/instant-quote/client-labels";

/** Keeps selected processing and unknown customer inputs visible when controls are collapsed. */
export function ClientOperationSummary({ operations, operationInputs, detectedBendCount }: {
  operations: readonly ManufacturingOperation[];
  operationInputs: OperationInputs;
  detectedBendCount: number | null;
}) {
  const missing = [
    operations.includes("bending") && operationInputs.bendCount == null && detectedBendCount == null ? "количество гибов" : null,
    operations.includes("welding") && operationInputs.weldLengthM == null ? "длина шва" : null,
    operations.includes("assembly") && operationInputs.assemblyMinutes == null ? "норма сборки" : null,
    operations.includes("powder-coating") && operationInputs.powderSides == null ? "стороны окраски" : null,
    operations.includes("surface-preparation") && operationInputs.surfacePreparationSides == null ? "стороны подготовки" : null,
  ].filter(Boolean);
  return <div>
    <p className="mt-3 text-xs leading-5 text-white/75"><span className="text-white/50">Состав: </span>{operationLabels([...operations]).join(" · ")}</p>
    {missing.length > 0 && <p className="mt-2 text-xs leading-5 text-amber-200">Уточнит инженер: {missing.join(", ")}. Без исходных данных автоматическая цена не подтверждается.</p>}
  </div>;
}
