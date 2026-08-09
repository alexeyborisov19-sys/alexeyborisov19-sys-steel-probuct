import { VerificationButton } from "@/components/pd-admin/ActionControls";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { EmptyState, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { hasPdPermission } from "@/lib/pd-admin/auth/permissions";
import { listIntegrityRuns } from "@/lib/pd-admin/integrity/service";

export const dynamic = "force-dynamic";

export default async function IntegrityPage() {
  const context = await requirePdPageContext("VIEW_INTEGRITY");
  const runs = listIntegrityRuns(context);
  const canRun = hasPdPermission(context.user.role, "RUN_INTEGRITY_CHECK");
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Контроль" title="Проверка целостности" description="Проверка работает в режиме чтения исходных JSON, consent-audit и карантина; первичные данные не изменяются." />
    {canRun ? <div className="mb-4"><VerificationButton csrfToken={shell.csrfToken} kind="integrity" /></div> : null}
    <Panel>{runs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="text-white/40"><tr>{["Время", "Завершено", "Статус", "Находки", "Хеш отчёта"].map((h) => <th key={h} className="border-b border-white/10 px-3 py-3">{h}</th>)}</tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-b border-white/5"><td className="px-3 py-3">{new Date(run.started_at).toLocaleString("ru-RU")}</td><td className="px-3 py-3">{run.completed_at ? new Date(run.completed_at).toLocaleString("ru-RU") : "—"}</td><td className="px-3 py-3"><StatusPill status={run.status === "COMPLETED" ? "ready" : run.status === "FAILED" ? "critical" : "warning"} label={run.status} /></td><td className="px-3 py-3">{run.findings_count}</td><td className="px-3 py-3">{run.report_sha256 ? `${run.report_sha256.slice(0, 12)}…` : "—"}</td></tr>)}</tbody></table></div> : <EmptyState>Проверки ещё не запускались.</EmptyState>}</Panel>
  </InternalShell>;
}
