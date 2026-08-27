import Link from "next/link";
import { StepUpForm } from "@/components/pd-admin/ActionControls";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { EmptyState, Pager, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";
import { listExports } from "@/lib/pd-admin/export/service";

export const dynamic = "force-dynamic";
export default async function ExportsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const context = await requirePdPageContext("VIEW_EXPORTS"); const result = listExports(context, Number((await searchParams).page || 1)); const canCreate = context.user.role !== "AUDITOR"; const stepUp = isStepUpActive(context.session.stepUpUntil); const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Минимизация и передача" title="Официальные выборочные выгрузки" description="Полная выгрузка без фильтра запрещена. Архив формируется вне public, имеет TTL и не отправляется автоматически." />
    <div className="mb-4 flex flex-wrap gap-3">{canCreate ? <Link prefetch={false} href="/internal/personal-data/exports/new" className="bg-steel-orange-deep px-5 py-3 text-xs font-bold uppercase">Создать draft</Link> : null}</div>
    {!stepUp && canCreate ? <Panel title="Утверждение, сборка и скачивание требуют step-up" className="mb-4"><StepUpForm csrfToken={shell.csrfToken} /></Panel> : null}
    <Panel>{result.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="text-white/40"><tr>{["ID", "Тип", "Запрос", "Статус", "Записей", "Вложений", "Размер", "Скачиваний", "Истекает", "Self approval"].map((h) => <th key={h} className="border-b border-white/10 px-3 py-3">{h}</th>)}</tr></thead><tbody>{result.items.map((item) => <tr key={String(item.id)} className="border-b border-white/5"><td className="px-3 py-3"><Link prefetch={false} href={`/internal/personal-data/exports/${item.id}`} className="text-[#ea5b0c]">{String(item.id).slice(0, 12)}…</Link></td><td className="px-3 py-3">{String(item.export_type)}</td><td className="px-3 py-3">{String(item.request_number || "—")}</td><td className="px-3 py-3"><StatusPill status={item.stage4_status === "READY" ? "ready" : item.stage4_status === "FAILED" ? "critical" : "warning"} label={String(item.stage4_status)} /></td><td className="px-3 py-3">{String(item.records_count)}</td><td className="px-3 py-3">{String(item.attachments_count)}</td><td className="px-3 py-3">{String(item.total_bytes)}</td><td className="px-3 py-3">{String(item.downloads_count)}</td><td className="px-3 py-3">{item.expires_at ? new Date(String(item.expires_at)).toLocaleString("ru-RU") : "—"}</td><td className="px-3 py-3">{item.approval_self_used ? "Да" : "Нет"}</td></tr>)}</tbody></table></div> : <EmptyState>Выгрузок нет.</EmptyState>}<Pager basePath="/internal/personal-data/exports" {...result} /></Panel>
  </InternalShell>;
}
