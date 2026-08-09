import Link from "next/link";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { EmptyState, Pager, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { listConsentRecords } from "@/lib/pd-admin/consents/repository";

export const dynamic = "force-dynamic";

export default async function ConsentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const context = await requirePdPageContext("VIEW_CONSENT");
  const result = await listConsentRecords(context, Number((await searchParams).page || 1));
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Правовые основания" title="Журнал согласий" description="Первичные consent-audit файлы читаются без изменения исходных записей." /><Panel>{result.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-white/40"><tr>{["Audit ID", "Request ID", "Дата", "Событие", "ПДн", "Реклама"].map((h) => <th key={h} className="border-b border-white/10 px-3 py-3">{h}</th>)}</tr></thead><tbody>{result.items.map((item) => <tr key={item.auditId} className="border-b border-white/5"><td className="px-3 py-3"><Link prefetch={false} className="text-[#ea5b0c]" href={`/internal/personal-data/consents/${item.auditId}`}>{item.auditId}</Link></td><td className="px-3 py-3">{item.requestId}</td><td className="px-3 py-3">{new Date(item.createdAt).toLocaleString("ru-RU")}</td><td className="px-3 py-3">{item.event}</td><td className="px-3 py-3"><StatusPill status="ready" label="зафиксировано" /></td><td className="px-3 py-3">{item.marketing ? "Да" : "Нет"}</td></tr>)}</tbody></table></div> : <EmptyState>Записей согласия не найдено.</EmptyState>}<Pager basePath="/internal/personal-data/consents" {...result} /></Panel></InternalShell>;
}
