import Link from "next/link";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { listInternalProductionReports } from "@/lib/server/instant-quote/private-production-report";

export const dynamic = "force-dynamic";

function money(value: number) {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}

export default async function ProductionCalculationsPage() {
  const context = await requirePdPageContext("VIEW_DASHBOARD");
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  context.close();
  const reports = await listInternalProductionReports(250);

  return <InternalShell {...shell}>
    <InternalPageHeader
      eyebrow="Только для сотрудников"
      title="Производственные расчёты"
      description="Закрытые технологические отчёты. Эти данные не передаются в клиентский интерфейс Steel Product Online."
    />
    <Panel title={`Отчёты · ${reports.length}`}>
      {reports.length === 0 ? <p className="text-sm text-white/45">Производственных отчётов пока нет.</p> : <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-white/10 text-[10px] uppercase tracking-[.12em] text-white/35">
            <tr><th className="p-3">Дата</th><th className="p-3">Проект</th><th className="p-3">Позиции</th><th className="p-3">Расчёт</th><th className="p-3">Статус</th><th className="p-3">База</th><th className="p-3"></th></tr>
          </thead>
          <tbody>{reports.map((report) => {
            const ready = report.partialParts === 0 && report.blockedParts === 0 && report.completeParts === report.totalParts;
            return <tr key={report.fileName} className="border-b border-white/[.06] align-top">
              <td className="p-3 whitespace-nowrap">{new Date(report.generatedAt).toLocaleString("ru-RU")}</td>
              <td className="p-3 font-semibold">{report.projectId}</td>
              <td className="p-3">{report.totalParts}</td>
              <td className="p-3 font-semibold tabular-nums">{money(report.confirmedDirectCostRub)}</td>
              <td className="p-3"><StatusPill status={ready ? "ready" : report.blockedParts ? "critical" : "warning"} label={ready ? "полный" : report.blockedParts ? `blocked ${report.blockedParts}` : `partial ${report.partialParts}`} /></td>
              <td className="p-3 text-xs text-white/45">{report.basisVersion}</td>
              <td className="p-3 text-right"><Link className="text-steel-orange hover:underline" href={`/internal/production-calculations/${encodeURIComponent(report.fileName)}`}>Открыть</Link></td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </Panel>
  </InternalShell>;
}
