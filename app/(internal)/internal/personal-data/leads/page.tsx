import Link from "next/link";
import { LeadSearchPanel } from "@/components/pd-admin/ActionControls";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { EmptyState, Pager, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { hasPdPermission } from "@/lib/pd-admin/auth/permissions";
import { listLeads, workflowStatuses } from "@/lib/pd-admin/leads/repository";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePdPageContext("VIEW_MASKED_LEADS");
  const query = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const status = first(query.status);
  const source = first(query.source);
  const requestId = first(query.requestId);
  const result = listLeads(context, { page: Number(first(query.page) || 1), requestId, status, source });
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  const canSearchContact = hasPdPermission(context.user.role, "SEARCH_CONTACT");
  const canSearchText = hasPdPermission(context.user.role, "SEARCH_TEXT");
  context.close();
  return <InternalShell {...shell}>
    <InternalPageHeader eyebrow="Реестр" title="Заявки" description="Контакты в реестре не отображаются. Раскрытие доступно только по основанию и фиксируется в журнале." />
    <Panel title="Фильтры и точный поиск по requestId"><form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <input name="requestId" defaultValue={requestId || ""} placeholder="SP-YYYYMMDD-XXXXXXXX" pattern="SP-(AI-)?[0-9]{8}-[A-F0-9]{8}" className="border border-white/15 bg-black/25 px-3 py-3 text-sm" />
      <select name="status" defaultValue={status || ""} className="border border-white/15 bg-[#0b0e10] px-3 py-3 text-sm"><option value="">Все статусы</option>{workflowStatuses.map((item) => <option key={item}>{item}</option>)}</select>
      <select name="source" defaultValue={source || ""} className="border border-white/15 bg-[#0b0e10] px-3 py-3 text-sm"><option value="">Все источники</option><option value="quote-form">Основная форма</option><option value="engineering-assistant">ИИ-инженер</option></select>
      <button className="border border-[#ea5b0c] px-4 py-3 text-xs font-bold uppercase text-[#ea5b0c]">Применить</button>
    </form></Panel>
    {canSearchContact || canSearchText ? <Panel title="Защищённый поиск" className="mt-4"><LeadSearchPanel csrfToken={shell.csrfToken} contactEnabled={canSearchContact} textEnabled={canSearchText} /></Panel> : null}
    <Panel className="mt-4">{result.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[920px] border-collapse text-left text-xs"><thead className="text-white/40"><tr>{["ID заявки", "Дата", "Источник", "Статус", "Ответственный", "Файлы", "Consent", "Целостность"].map((head) => <th key={head} className="border-b border-white/10 px-3 py-3 font-semibold">{head}</th>)}</tr></thead><tbody>{result.items.map((item) => <tr key={item.requestId} className="border-b border-white/5 hover:bg-white/[.025]">
      <td className="px-3 py-3"><Link prefetch={false} href={`/internal/personal-data/leads/${item.requestId}`} className="font-semibold text-[#ea5b0c]">{item.requestId}</Link></td>
      <td className="px-3 py-3">{new Date(item.createdAt).toLocaleString("ru-RU")}</td><td className="px-3 py-3">{item.source}</td><td className="px-3 py-3">{item.internalStatus}</td><td className="px-3 py-3">{item.assignedDisplayName || "Не назначен"}</td><td className="px-3 py-3">{item.filesCount}</td><td className="px-3 py-3"><StatusPill status={item.consentAuditStatus === "recorded" ? "ready" : "warning"} label={item.consentAuditStatus} /></td><td className="px-3 py-3"><StatusPill status={item.integrityStatus === "OK" ? "ready" : "warning"} label={item.integrityStatus} /></td>
    </tr>)}</tbody></table></div> : <EmptyState>В индекс пока не добавлено ни одной заявки.</EmptyState>}
    <Pager basePath="/internal/personal-data/leads" {...result} /></Panel>
  </InternalShell>;
}
