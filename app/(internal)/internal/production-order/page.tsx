import Link from "next/link";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { listInternalProductionReports } from "@/lib/server/instant-quote/private-production-report";
import { readProductionOrderStorageSettings } from "@/lib/server/production-order/storage-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readiness(status: "ready" | "review" | "blocked") {
  if (status === "ready") return { status: "ready" as const, label: "готов" };
  if (status === "blocked") return { status: "critical" as const, label: "заблокирован" };
  return { status: "warning" as const, label: "нужна проверка" };
}

export default async function ProductionOrderPage() {
  const context = await requirePdPageContext("VIEW_DASHBOARD");
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  const [reports, storage] = await Promise.all([
    listInternalProductionReports(100),
    readProductionOrderStorageSettings(),
  ]);
  context.close();

  return <InternalShell {...shell}>
    <InternalPageHeader
      eyebrow="Модуль производственных заказов"
      title="Создание КП и заявки в производство"
      description="Выберите зафиксированный производственный расчёт. На следующем шаге можно указать номер и название КП, заказчика, сроки, ответственного и скорректировать позиции перед созданием папки заказа."
    />

    <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
      <div className={`border p-4 text-sm ${storage.ordersRoot ? "border-emerald-400/20 bg-emerald-400/[.04]" : "border-amber-400/20 bg-amber-400/[.04]"}`}>
        <div className="text-xs font-bold uppercase tracking-[.12em] text-white/40">Папка заказов</div>
        <div className="mt-2 break-all font-mono text-white/75">{storage.ordersRoot ?? "Путь не настроен"}</div>
      </div>
      <Link href="/internal/production-order/settings" className="flex min-h-12 items-center justify-center border border-white/20 px-5 py-3 text-sm font-semibold hover:border-white/45">Настроить путь</Link>
    </div>

    <Panel title={`Производственные расчёты · ${reports.length}`}>
      {reports.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-white/10 text-[10px] uppercase tracking-[.12em] text-white/35"><tr><th className="p-3">Проект</th><th className="p-3">Сформирован</th><th className="p-3">Позиции</th><th className="p-3">Готовность</th><th className="p-3">Ревизия</th><th className="p-3 text-right">Действие</th></tr></thead>
          <tbody>{reports.map((report) => {
            const state = readiness(report.readinessStatus);
            return <tr key={report.fileName} className="border-b border-white/[.06]">
              <td className="p-3"><div className="font-semibold">{report.projectId}</div><div className="mt-1 font-mono text-[10px] text-white/35">{report.reportId}</div></td>
              <td className="p-3 text-white/65">{new Date(report.generatedAt).toLocaleString("ru-RU")}</td>
              <td className="p-3">{report.totalParts}</td>
              <td className="p-3"><div className="flex items-center gap-3"><StatusPill status={state.status} label={state.label} /><span className="text-xs text-white/45">{report.readinessScorePct}%</span></div></td>
              <td className="p-3 text-white/55">{report.isRevision ? "Да" : "Нет"}</td>
              <td className="p-3 text-right"><Link href={`/internal/production-order/from-calculation/${encodeURIComponent(report.fileName)}`} className="inline-flex min-h-10 items-center border border-steel-orange/60 px-4 py-2 text-xs font-bold text-steel-orange hover:bg-steel-orange hover:text-black">Создать документы</Link></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <div className="border border-white/10 bg-white/[.02] p-5 text-sm text-white/55">Сначала сформируйте производственный расчёт из CAD-файлов.</div>}
    </Panel>
  </InternalShell>;
}
