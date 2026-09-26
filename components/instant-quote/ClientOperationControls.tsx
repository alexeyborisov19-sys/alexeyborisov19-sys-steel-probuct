"use client";

import type { ClientCountersinkFeature } from "@/lib/instant-quote/client-cad-preview-types";
import type { ManufacturingOperation, OperationInputs } from "@/lib/instant-quote/domain";
import {
  operationTableDefaultInputPatch,
  OPERATION_TABLE_DEFAULTS,
} from "@/lib/instant-quote/operation-table-defaults";

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

const OPERATION_QUANTITY: Partial<Record<ManufacturingOperation, {
  field: CountableField;
  label: string;
  step: number;
  max: number;
  note?: string;
}>> = {
  bending: {
    field: "bendCount",
    label: "Гибов на деталь",
    step: 1,
    max: 500,
    note: `Если CAD не дал достоверное количество, подставляется табличное значение ${OPERATION_TABLE_DEFAULTS.bendCount}. Проверьте его по чертежу.`,
  },
  welding: {
    field: "weldLengthM",
    label: "Длина шва, м",
    step: 0.1,
    max: 500,
    note: `Ваша оценка: по умолчанию подставляется табличное значение ${OPERATION_TABLE_DEFAULTS.weldLengthM} м шва на изделие. Тип соединения, катет и доступ к шву подтвердит технолог.`,
  },
  countersink: {
    field: "countersinkCount",
    label: "Зенковок на деталь",
    step: 1,
    max: 100_000,
    note: `Для ручного ввода используется количество заданных отверстий. Если ни ручной ввод, ни STEP не дали количество, подставляется табличное значение ${OPERATION_TABLE_DEFAULTS.countersinkCount}. Измените его, если зенкуются не все отверстия.`,
  },
  assembly: {
    field: "assemblyMinutes",
    label: "Сборка, мин на деталь",
    step: 1,
    max: 10_000,
    note: `Ваша оценка: по умолчанию подставляется табличная норма ${OPERATION_TABLE_DEFAULTS.assemblyMinutes} минут на деталь. Значение можно изменить. Норму сборки определит технолог при проверке.`,
  },
};

type SidesField = "powderSides" | "surfacePreparationSides";

const OPERATION_SIDES: Partial<Record<ManufacturingOperation, {
  field: SidesField;
  label: string;
  note: string;
}>> = {
  "powder-coating": {
    field: "powderSides",
    label: "Сторон окраски",
    note: `По умолчанию — ${OPERATION_TABLE_DEFAULTS.powderSides} стороны. Выберите 1, если окрашивается только одна сторона.`,
  },
  "surface-preparation": {
    field: "surfacePreparationSides",
    label: "Сторон подготовки",
    note: `По умолчанию — ${OPERATION_TABLE_DEFAULTS.surfacePreparationSides} стороны. Выберите 1, если подготовка нужна только с одной стороны.`,
  },
};

export type ClientOperationControlsProps = {
  operations: readonly ManufacturingOperation[];
  operationInputs: OperationInputs;
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
                onClick={() => {
                  if (!enabled) {
                    const patch = operationTableDefaultInputPatch(
                      option.id,
                      operationInputs,
                      {
                        detectedBendCount,
                        detectedCountersinkCount,
                      },
                    );
                    if (Object.keys(patch).length > 0) onQuantityChange(patch);
                  }
                  onToggle(option.id);
                }}
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
                          ? Math.max(
                              option.id === "countersink" ? detectedCountersinkCount ?? 0 : 0,
                              Math.min(
                                quantity.field === "bendCount" || quantity.field === "countersinkCount"
                                  ? Math.floor(parsed)
                                  : parsed,
                                quantity.max,
                              ),
                            )
                          : undefined,
                      });
                    }}
                    className="w-20 border border-white/12 bg-transparent px-2 py-1 text-right text-sm"
                  />
                </label>
              )}

              {enabled && quantity && (
                <button
                  type="button"
                  onClick={() => onQuantityChange({ [quantity.field]: undefined })}
                  className="mt-2 min-h-11 px-4 text-left text-sm text-steel-orange underline underline-offset-4"
                >
                  Не знаю — уточнит инженер
                </button>
              )}
              {enabled && quantity?.note && (
                <p className="mt-1 px-4 text-[10px] leading-relaxed text-white/40">{quantity.note}</p>
              )}

              {enabled && option.id === "bending" && detectedBendCount != null && detectedBendCount > 0 && (
                <p className="mt-1 px-4 text-[10px] leading-relaxed text-steel-orange">
                  Определено по 3D-модели: {detectedBendCount}. Изменение значения требует проверки инженером.
                </p>
              )}

              {enabled && option.id === "countersink" && detectedCountersinkCount != null && (
                <p className="mt-1 px-4 text-xs leading-relaxed text-steel-orange">
                  По STEP распознано {countersinkDetectionComplete === false ? "не менее " : ""}{detectedCountersinkCount} зенковок. Проверьте полноту по чертежу; дополнительные зенковки можно добавить вручную.
                </p>
              )}

              {enabled && option.id === "countersink" && detectedCountersinks.length > 0 && (
                <details className="mt-2 px-4 text-xs text-white/70">
                  <summary className="cursor-pointer py-2">Размеры по STEP</summary>
                  <ul className="space-y-1">
                    {detectedCountersinks.map((feature, index) => (
                      <li key={index}>
                        № {index + 1}: Ø{Number(feature.smallDiameterMm.toFixed(3))} → Ø{Number(feature.largeDiameterMm.toFixed(3))} мм; глубина {Number(feature.depthMm.toFixed(3))} мм; {Number(feature.includedAngleDeg.toFixed(2))}°
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">Малые конические фаски тоже показаны. Назначение и способ обработки подтвердит технолог.</p>
                </details>
              )}

              {enabled && sides && (
                <>
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
                  <button
                    type="button"
                    onClick={() => onQuantityChange({ [sides.field]: undefined })}
                    className="mt-2 min-h-11 px-4 text-left text-sm text-steel-orange underline underline-offset-4"
                  >
                    Не знаю — уточнит инженер
                  </button>
                  <p className="mt-1 px-4 text-[10px] leading-relaxed text-white/40">{sides.note}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
