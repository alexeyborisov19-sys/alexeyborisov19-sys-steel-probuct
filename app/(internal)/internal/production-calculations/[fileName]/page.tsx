import Link from "next/link";
import { notFound } from "next/navigation";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { readInternalProductionReport } from "@/lib/server/instant-quote/private-production-report";

export const dynamic = "force-dynamic";

function money(value: number) {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}
function number(value: number | null, suffix = "") {
  return value == null ? "—" : `${value.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}${suffix}`;
}

export default async function ProductionCalculationDetailPage({ params }: { params: Promise<{ fileName: string }> }) {
  const context = await requirePdPageContext("VIEW_DASHBOARD");
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  context.close();

  let report;
  try {
    const { fileName } = await params;
    report = await readInternalProductionReport(decodeURIComponent(fileName));
  } catch {
    notFound();
  }

  return <InternalShell {...shell}>
    <div className="mb-5"><Link href="/internal/production-calculations" className="text-sm text-steel-orange hover:underline">← Все производственные расчёты</Link></div>
    <InternalPageHeader
      eyebrow="Конфиденциально · только внутренний доступ"
      title={`Расчёт ${report.projectId}`}
      description={`Сформирован ${new Date(report.generatedAt).toLocaleString("ru-RU")} · расчётная база ${report.basisVersion}`}
    />

    <div className="grid gap-4 md:grid-cols-4">
      <Panel title="Подтверждено"><div className="text-2xl font-semibold">{money(report.calculation.confirmedDirectCostRub)}</div><p className="mt-2 text-xs text-white/40">Внутренняя сумма только подтверждённых статей.</p></Panel>
      <Panel title="Позиции"><div className="text-2xl font-semibold">{report.calculation.totalParts}</div></Panel>
      <Panel title="Полные"><div className="text-2xl font-semibold">{report.calculation.completeParts}</div></Panel>
      <Panel title="Требуют проверки"><div className="text-2xl font-semibold">{report.calculation.partialParts + report.calculation.blockedParts}</div></Panel>
    </div>

    <div className="mt-6 space-y-6">
      {report.calculation.parts.map((part, index) => {
        const parameters = report.productionParametersByPartId[part.partId];
        const calculation = part.calculation;
        return <Panel key={part.partId} title={`Позиция ${index + 1} · ${part.partId}`}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <StatusPill status={part.status === "complete" ? "ready" : part.status === "blocked" ? "critical" : "warning"} label={part.status} />
            {calculation && <span className="text-sm font-semibold">Подтверждённые затраты: {money(calculation.confirmedDirectCostRubBatch)}</span>}
          </div>

          {parameters && <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div className="border border-white/10 p-3"><div className="text-white/35">Габарит</div><div className="mt-1">{number(parameters.dimensionsMm.width, " мм")} × {number(parameters.dimensionsMm.height, " мм")} × {number(parameters.dimensionsMm.depth, " мм")}</div></div>
            <div className="border border-white/10 p-3"><div className="text-white/35">Заготовка</div><div className="mt-1">{number(parameters.stock.blankWidthMm, " мм")} × {number(parameters.stock.blankHeightMm, " мм")}</div><div className="mt-1 text-xs text-white/40">{parameters.stock.strategy ?? "—"}</div></div>
            <div className="border border-white/10 p-3"><div className="text-white/35">Масса нетто / закупочная</div><div className="mt-1">{number(parameters.mass.netKgEach, " кг")} / {number(parameters.mass.purchasedKgEach, " кг")}</div><div className="mt-1 text-xs text-white/40">Партия: {number(parameters.mass.purchasedKgBatch, " кг")}</div></div>
            <div className="border border-white/10 p-3"><div className="text-white/35">Отход</div><div className="mt-1">{number(parameters.stock.wasteAreaMm2Each, " мм²")} · {number(parameters.stock.wastePct, "%")}</div></div>
            <div className="border border-white/10 p-3"><div className="text-white/35">Лазер</div><div className="mt-1">{number(parameters.cutting.cutLengthMBatch, " м реза")}</div><div className="mt-1 text-xs text-white/40">Прожиги: {number(parameters.cutting.pierceCountBatch)}</div></div>
            <div className="border border-white/10 p-3"><div className="text-white/35">Гибка</div><div className="mt-1">{number(parameters.bending.bendCountBatch, " гибов")}</div></div>
            <div className="border border-white/10 p-3"><div className="text-white/35">Сварка</div><div className="mt-1">{number(parameters.welding.weldLengthMBatch, " м")}</div></div>
            <div className="border border-white/10 p-3"><div className="text-white/35">Окраска</div><div className="mt-1">{number(parameters.coating.powderAreaM2Batch, " м²")}</div></div>
          </div>}

          {calculation && <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-white/10 text-[10px] uppercase tracking-[.12em] text-white/35"><tr><th className="p-2">Статья</th><th className="p-2">Количество</th><th className="p-2">Ставка</th><th className="p-2">На шт.</th><th className="p-2">Партия</th><th className="p-2">Источник</th></tr></thead>
              <tbody>{calculation.lines.map((line) => <tr key={line.code} className="border-b border-white/[.06]"><td className="p-2 font-semibold">{line.label}</td><td className="p-2">{number(line.quantity)} {line.unit}</td><td className="p-2 tabular-nums">{money(line.rateRub)}</td><td className="p-2 tabular-nums">{money(line.amountRubEach)}</td><td className="p-2 tabular-nums">{money(line.amountRubBatch)}</td><td className="p-2 text-xs text-white/45">{line.source.label}<br />{line.source.confirmedAt}</td></tr>)}</tbody>
            </table>
          </div>}

          {(calculation?.missing.length ?? 0) > 0 && <div className="mt-5 border border-amber-400/20 bg-amber-400/[.05] p-4"><div className="text-xs font-bold uppercase tracking-[.12em] text-amber-200">Не закрыто в расчёте</div><ul className="mt-3 space-y-2 text-sm text-amber-50/80">{calculation?.missing.map((item) => <li key={`${item.code}-${item.label}`}>• <b>{item.label}</b>: {item.reason}</li>)}</ul></div>}

          {(part.dfmBlockingReasons.length > 0 || part.dfmReviewReasons.length > 0) && <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="border border-red-400/20 p-4"><div className="text-xs font-bold uppercase tracking-[.12em] text-red-300">DFM blocking</div><ul className="mt-2 space-y-1 text-sm text-white/60">{part.dfmBlockingReasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul></div>
            <div className="border border-amber-400/20 p-4"><div className="text-xs font-bold uppercase tracking-[.12em] text-amber-200">DFM review</div><ul className="mt-2 space-y-1 text-sm text-white/60">{part.dfmReviewReasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul></div>
          </div>}
        </Panel>;
      })}
    </div>

    {report.internalNotes.length > 0 && <Panel title="Внутренние примечания" className="mt-6"><ul className="space-y-2 text-sm text-white/65">{report.internalNotes.map((note) => <li key={note}>• {note}</li>)}</ul></Panel>}
  </InternalShell>;
}
