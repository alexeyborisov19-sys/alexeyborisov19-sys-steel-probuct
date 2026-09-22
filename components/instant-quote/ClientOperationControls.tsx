"use client";

import type { ClientCountersinkFeature } from "@/lib/instant-quote/client-cad-preview-types";
import type { ManufacturingOperation, OperationInputs } from "@/lib/instant-quote/domain";

const OPERATION_OPTIONS: ReadonlyArray<{ id: ManufacturingOperation; label: string }> = [
  { id: "bending", label: "Гибка" },
  { id: "welding", label: "Сварка" },
  { id: "countersink", label: "Зенковка" },
  { id: "assembly", label: "Сборка" },
  { id: "surface-preparation", label: "Подготовка поверхности" },
  { id: "powder-coating", label: "Порошковая окраска" },
  { id: "packaging", label: "Упаковка" },
];

type CountableField = "bendCount" | "countersinkCount" | "weldLengthM" | "assemblyMinutes";

/**
 * A CAD file carries none of these: a DXF has no bend count, no weld length and
 * no coating-side choice. Without them the matching cost article cannot be
 * completed, so the customer states them here and an engineer confirms them.
 */
const OPERATION_QUANTITY: Partial<Record<ManufacturingOperation, {
  field: CountableField;
  label: string;
  step: number;
  max: number;
  /**
   * Said out loud where the number is a technologist's parameter rather than
   * something a customer can be expected to know. It goes straight into the
   * automatic price, so five minutes entered instead of thirty is a five-fold
   * error in that article — the customer should know it is their estimate.
   */
  note?: string;
}>> = {
  bending: { field: "bendCount", label: "Гибов на деталь", step: 1, max: 500 },
  countersink: { field: "countersinkCount", label: "Зенковок на деталь", step: 1, max: 100_000, note: "Каждая обработанная сторона отверстия считается отдельно. Проверьте диаметр, угол и глубину по чертежу." },
  welding: {
    field: "weldLengthM",
    label: "Длина шва, м",
    step: 0.1,
    max: 500,
    note: "Суммарная длина сварных швов на одно изделие. По обычному STEP швы нельзя определить однозначно: укажите длину по чертежу. Тип соединения, катет и доступ к шву подтвердит технолог.",
  },
  assembly: {
    field: "assemblyMinutes",
    label: "Сборка, мин на деталь",
    step: 1,
    max: 10_000,
    note: "Ваша оценка. Норму сборки определит технолог при проверке.",
  },
};

type SidesField = "powderSides" | "surfacePreparationSides";

/**
 * Operations charged by treated area. The area is the part's own net area times
 * the number of sides, so the side count is the one thing the drawing cannot
 * supply and the customer has to state.
 */
const OPERATION_SIDES: Partial<Record<ManufacturingOperation, { field: SidesField; label: string }>> = {
  "powder-coating": { field: "powderSides", label: "Сторон окраски" },
  "surface-preparation": { field: "surfacePreparationSides", label: "Сторон подготовки" },
};

export type ClientOperationControlsProps = {
  operations: readonly ManufacturingOperation[];
  operationInputs: OperationInputs;
  /** Bends read from the uploaded STEP model, when the evidence was unambiguous. */
  detectedBendCount?: number | null;
  detectedCountersinkCount?: number | null;
  countersinkDetectionComplete?: boolean;
  detectedCountersinks?: ClientCountersinkFeature[];
  onToggle: (operation: ManufacturingOperation) => void;
  onQuantityChange: (patch: OperationInputs) => void;
};

export function ClientOperationControls({
  operations,
  operationInputs,
  detectedBendCount = null,
  detectedCountersinkCount = null,
  countersinkDetectionComplete,
  detectedCountersinks = [],
  onToggle,
  onQuantityChange,
}: ClientOperationControlsProps) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.13em] text-white/35">Операции</p>
      <div className="mt-2 grid gap-2">
        {OPERATION_OPTIONS.map((option) => {
          const enabled = operations.includes(option.id);
          const quantity = OPERATION_QUANTITY[option.id];
          const sides = OPERATION_SIDES[option.id];

          return (
            <div key={option.id}>
              <button
                type="button"
                aria-pressed={enabled}
                onClick={() => onToggle(option.id)}
                className={`flex w-full items-center justify-between border px-4 py-3 text-left text-sm ${enabled ? "border-steel-orange/45 bg-steel-orange/[.06]" : "border-white/10"}`}
              >
                <span>{option.label}</span>
                <span aria-hidden="true">{enabled ? "✓" : ""}</span>
              </button>

              {enabled && quantity && (
                <label className="mt-1 flex items-center gap-3 border border-white/10 bg-[#090c0e] px-4 py-2">
                  <span className="grow text-[10px] uppercase tracking-[.1em] text-white/40">{quantity.label}</span>
                  <input
                    type="number"
                    min={option.id === "countersink" ? detectedCountersinkCount ?? 0 : 0}
                    max={quantity.max}
                    step={quantity.step}
                    value={operationInputs[quantity.field] ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value;
                      const parsed = raw === "" ? undefined : Number(raw);
                      onQuantityChange({
                        [quantity.field]: parsed != null && Number.isFinite(parsed) && parsed >= 0
                          ? Math.max(option.id === "countersink" ? detectedCountersinkCount ?? 0 : 0, Math.min(parsed, quantity.max))
                          : undefined,
                      });
                    }}
                    className="w-20 border border-white/12 bg-transparent px-2 py-1 text-right text-sm"
                  />
                </label>
              )}

              {enabled && quantity && <button type="button" onClick={() => onQuantityChange({ [quantity.field]: undefined })} className="mt-2 min-h-11 px-4 text-left text-sm text-steel-orange underline underline-offset-4">Не знаю — уточнит инженер</button>}
              {enabled && quantity?.note && (
                <p className="mt-1 px-4 text-[10px] leading-relaxed text-white/40">{quantity.note}</p>
              )}

              {enabled && option.id === "bending" && detectedBendCount != null && detectedBendCount > 0 && (
                <p className="mt-1 px-4 text-[10px] leading-relaxed text-steel-orange">
                  Определено по 3D-модели: {detectedBendCount}. Изменение значения требует проверки инженером.
                </p>
              )}

              {enabled && option.id === "countersink" && detectedCountersinkCount != null && <p className="mt-1 px-4 text-xs leading-relaxed text-steel-orange">По STEP распознано {countersinkDetectionComplete === false ? "не менее " : ""}{detectedCountersinkCount} зенковок. Проверьте полноту по чертежу; дополнительные зенковки можно добавить вручную.</p>}

              {enabled && option.id === "countersink" && detectedCountersinks.length > 0 && <details className="mt-2 px-4 text-xs text-white/70"><summary className="cursor-pointer py-2">Размеры по STEP</summary><ul className="space-y-1">{detectedCountersinks.map((feature, index) => <li key={index}>№ {index + 1}: Ø{Number(feature.smallDiameterMm.toFixed(3))} → Ø{Number(feature.largeDiameterMm.toFixed(3))} мм; глубина {Number(feature.depthMm.toFixed(3))} мм; {Number(feature.includedAngleDeg.toFixed(2))}°</li>)}</ul><p className="mt-2">Малые конические фаски тоже показаны. Назначение и способ обработки подтвердит технолог.</p></details>}

              {enabled && sides && (
                <div className="mt-1 flex items-center gap-3 border border-white/10 bg-[#090c0e] px-4 py-2">
                  <span className="grow text-[10px] uppercase tracking-[.1em] text-white/40">{sides.label}</span>
                  <div className="flex gap-1">
                    {([1, 2] as const).map((count) => (
                      <button
                        key={count}
                        type="button"
                        aria-pressed={operationInputs[sides.field] === count}
                        onClick={() => onQuantityChange({ [sides.field]: count })}
                        className={`h-7 w-9 border text-xs font-semibold ${operationInputs[sides.field] === count ? "border-steel-orange bg-steel-orange/15 text-steel-orange" : "border-white/12 text-white/50"}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
