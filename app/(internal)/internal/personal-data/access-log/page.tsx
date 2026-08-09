import { VerificationButton } from "@/components/pd-admin/ActionControls";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { EmptyState, Pager, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { hasPdPermission } from "@/lib/pd-admin/auth/permissions";
import { listAccessEvents } from "@/lib/pd-admin/audit/repository";

export const dynamic = "force-dynamic";

export default async function AccessLogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const context = await requirePdPageContext("VIEW_ACCESS_LOG");
  const result = listAccessEvents(context, Number((await searchParams).page || 1));
  const canVerify = hasPdPermission(context.user.role, "VERIFY_ACCESS_LOG");
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Контроль" title="Журнал доступа" description="Журнал использует цепочку хешей для обнаружения изменения или удаления записей; абсолютная неизменяемость не заявляется." />
    {canVerify ? <div className="mb-4"><VerificationButton csrfToken={shell.csrfToken} kind="audit" /></div> : null}
    <Panel>{result.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="text-white/40"><tr>{["№", "Время", "Сотрудник", "Действие", "Объект", "Основание", "Результат"].map((h) => <th key={h} className="border-b border-white/10 px-3 py-3">{h}</th>)}</tr></thead><tbody>{result.items.map((item) => <tr key={item.id} className="border-b border-white/5"><td className="px-3 py-3">{item.id}</td><td className="px-3 py-3">{new Date(item.occurredAt).toLocaleString("ru-RU")}</td><td className="px-3 py-3">{item.actor || "Система"}<br /><span className="text-white/35">{item.role || "—"}</span></td><td className="px-3 py-3">{item.action}</td><td className="px-3 py-3">{item.targetType}{item.targetId ? <><br /><span className="text-white/35">{item.targetId}</span></> : null}</td><td className="px-3 py-3">{item.legalBasis || "—"}</td><td className="px-3 py-3"><StatusPill status={item.result === "SUCCESS" ? "ready" : "warning"} label={item.result} /></td></tr>)}</tbody></table></div> : <EmptyState>Журнал пока пуст.</EmptyState>}<Pager basePath="/internal/personal-data/access-log" {...result} /></Panel>
  </InternalShell>;
}
