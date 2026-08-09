import Link from "next/link";
import { StepUpForm } from "@/components/pd-admin/ActionControls";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { SecureMutationForm } from "@/components/pd-admin/Stage4Forms";
import { EmptyState, Pager, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";
import { listLegalHolds } from "@/lib/pd-admin/legal-holds/repository";

export const dynamic = "force-dynamic";
export default async function LegalHoldsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const context = await requirePdPageContext("VIEW_LEGAL_HOLD"); const result = listLegalHolds(context, Number((await searchParams).page || 1)); const canCreate = ["ADMIN", "PERSONAL_DATA_OFFICER"].includes(context.user.role); const stepUp = isStepUpActive(context.session.stepUpUntil); const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Запрет уничтожения" title="Legal hold" description="Активное основание блокирует удаление заявки, вложений и связанных данных. Снятие требует step-up и не отменяет другие основания." />
    {canCreate ? <Panel title="Создать legal hold" className="mb-4"><SecureMutationForm csrfToken={shell.csrfToken} endpoint="/api/internal/personal-data/legal-holds" submitLabel="Установить блокировку" fields={[{ name: "requestIds", label: "Request ID — по одному в строке", kind: "lines", required: true }, { name: "reason", label: "Причина", kind: "textarea", required: true }, { name: "basisDocument", label: "Документ-основание" }, { name: "reviewAt", label: "Дата пересмотра", kind: "datetime-local", required: true }, { name: "subjectRequestId", label: "Технический ID обращения субъекта" }, { name: "authorityRequestId", label: "Технический ID запроса органа" }, { name: "incidentId", label: "Технический ID инцидента" }]} /></Panel> : null}
    {!stepUp && canCreate ? <Panel title="Для снятия блокировки" className="mb-4"><StepUpForm csrfToken={shell.csrfToken} /></Panel> : null}
    <Panel>{result.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="text-white/40"><tr>{["ID", "Статус", "Начало", "Пересмотр", "Заявок", "Основание"].map((h) => <th key={h} className="border-b border-white/10 px-3 py-3">{h}</th>)}</tr></thead><tbody>{result.items.map((item) => <tr key={String(item.id)} className="border-b border-white/5"><td className="px-3 py-3"><Link prefetch={false} href={`/internal/personal-data/legal-holds/${item.id}`} className="text-[#ea5b0c]">{String(item.id).slice(0, 12)}…</Link></td><td className="px-3 py-3"><StatusPill status={item.stage4_status === "ACTIVE" ? "warning" : item.stage4_status === "RELEASED" ? "disabled" : "critical"} label={String(item.stage4_status)} /></td><td className="px-3 py-3">{new Date(String(item.started_at)).toLocaleString("ru-RU")}</td><td className="px-3 py-3">{new Date(String(item.review_at)).toLocaleString("ru-RU")}</td><td className="px-3 py-3">{String(item.leads_count)}</td><td className="px-3 py-3">{String(item.reason)}</td></tr>)}</tbody></table></div> : <EmptyState>Legal hold не зарегистрированы.</EmptyState>}<Pager basePath="/internal/personal-data/legal-holds" {...result} /></Panel>
  </InternalShell>;
}
