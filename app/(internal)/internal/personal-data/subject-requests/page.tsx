import Link from "next/link";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { EmptyState, Pager, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { listSubjectRequests } from "@/lib/pd-admin/subject-requests/repository";

export const dynamic = "force-dynamic";
export default async function SubjectRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const context = await requirePdPageContext("VIEW_SUBJECT_REQUESTS"); const query = await searchParams; const result = listSubjectRequests(context, Number(query.page || 1));
  const canCreate = ["ADMIN", "PERSONAL_DATA_OFFICER"].includes(context.user.role); const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Права субъектов" title="Обращения субъектов ПДн" description="Срок, идентификация и каждое изменение фиксируются. Неподтверждённое обращение не запускает удаление данных." />
    {canCreate ? <Link prefetch={false} href="/internal/personal-data/subject-requests/new" className="mb-4 inline-block bg-steel-orange-deep px-5 py-3 text-xs font-bold uppercase">Зарегистрировать обращение</Link> : null}
    <Panel>{result.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="text-white/40"><tr>{["Номер", "Получено", "Тип", "Заявитель", "Идентификация", "Статус", "Срок", "Связей"].map((item) => <th key={item} className="border-b border-white/10 px-3 py-3">{item}</th>)}</tr></thead><tbody>{result.items.map((item) => <tr key={item.id} className="border-b border-white/5"><td className="px-3 py-3"><Link prefetch={false} href={`/internal/personal-data/subject-requests/${item.id}`} className="text-[#ea5b0c]">{item.registrationNumber}</Link></td><td className="px-3 py-3">{new Date(item.receivedAt).toLocaleString("ru-RU")}</td><td className="px-3 py-3">{item.requestType}</td><td className="px-3 py-3">{item.subjectName}</td><td className="px-3 py-3"><StatusPill status={item.identityStatus === "VERIFIED" ? "ready" : "warning"} label={item.identityStatus} /></td><td className="px-3 py-3">{item.status}</td><td className="px-3 py-3">{new Date(item.extendedDueAt || item.dueAt).toLocaleString("ru-RU")}</td><td className="px-3 py-3">{item.leadsCount}</td></tr>)}</tbody></table></div> : <EmptyState>Обращений пока нет.</EmptyState>}<Pager basePath="/internal/personal-data/subject-requests" {...result} /></Panel>
  </InternalShell>;
}
