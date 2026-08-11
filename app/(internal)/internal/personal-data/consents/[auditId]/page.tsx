import { notFound } from "next/navigation";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { getConsentRecord } from "@/lib/pd-admin/consents/repository";

export const dynamic = "force-dynamic";

export default async function ConsentPage({ params }: { params: Promise<{ auditId: string }> }) {
  const context = await requirePdPageContext("VIEW_CONSENT");
  const consent = await getConsentRecord(context, (await params).auditId).catch(() => null);
  if (!consent) { context.close(); notFound(); }
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Согласие" title="Запись consent-audit" description="Содержимое первичного файла не изменяется." /><Panel><dl className="grid gap-4 text-sm sm:grid-cols-2">{[
    ["Audit ID", consent.auditId], ["Request ID", consent.requestId], ["Событие", consent.event], ["Создано", new Date(consent.createdAt).toLocaleString("ru-RU")],
    ["Клиентское время", consent.clientTimestamp || "Не указано"], ["Версия согласия", consent.personalDataConsentVersion], ["Версия политики", consent.privacyVersion], ["Срок хранения", consent.retentionDays ? `${consent.retentionDays} дней` : "Не указан"],
  ].map(([key, value]) => <div key={key} className="border border-white/10 p-3"><dt className="text-[10px] uppercase text-white/40">{key}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl><div className="mt-4 flex gap-2"><StatusPill status={consent.personalData ? "ready" : "critical"} label={`ПДн: ${consent.personalData ? "да" : "нет"}`} /><StatusPill status={consent.marketing ? "warning" : "unknown"} label={`Реклама: ${consent.marketing ? "да" : "нет"}`} /></div></Panel></InternalShell>;
}
