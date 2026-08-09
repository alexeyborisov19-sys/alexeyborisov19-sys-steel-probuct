import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { MetricCard, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { dashboardSnapshot } from "@/lib/pd-admin/dashboard/service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await requirePdPageContext("VIEW_DASHBOARD");
  const data = dashboardSnapshot(context.database, context.config);
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  context.close();
  const metrics = [
    ["Всего заявок", data.leads.total], ["Новые", data.leads.new], ["В работе", data.leads.inProgress],
    ["Нужно уточнение", data.leads.needsClarification], ["Закрытые", data.leads.closed], ["Сегодня", data.leads.today],
    ["За 7 дней", data.leads.sevenDays], ["За 30 дней", data.leads.thirtyDays], ["С вложениями", data.leads.withAttachments],
    ["Нет/отложен consent", data.leads.missingConsent], ["SMTP deferred", data.leads.smtpDeferred], ["Повреждённые JSON", data.leads.corruptJson],
    ["Истекают за 7 дней", data.leads.expiringSevenDays], ["Просрочены", data.leads.expired], ["Legal hold", data.leads.legalHold],
  ] as const;
  return <InternalShell {...shell}>
    <InternalPageHeader eyebrow="Обзор" title="Состояние обработки персональных данных" description="Показатели не содержат открытых контактов или текстов обращений." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label, value]) => <MetricCard key={label} label={label} value={value} tone={label.includes("Повреж") || label === "Просрочены" ? "critical" : label.includes("consent") || label.includes("deferred") || label.includes("Истекают") ? "warning" : "default"} />)}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <Panel title="Источники и пользователи"><dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-white/40">Основная форма</dt><dd className="mt-1 text-xl">{data.leads.quoteForm}</dd></div>
        <div><dt className="text-white/40">ИИ-инженер</dt><dd className="mt-1 text-xl">{data.leads.engineeringAssistant}</dd></div>
        <div><dt className="text-white/40">Активные пользователи</dt><dd className="mt-1 text-xl">{data.users.active}</dd></div>
        <div><dt className="text-white/40">Заблокированные</dt><dd className="mt-1 text-xl">{data.users.locked}</dd></div>
        <div><dt className="text-white/40">Неудачные входы за 24 часа</dt><dd className="mt-1 text-xl">{data.users.failedLogins24h}</dd></div>
        <div><dt className="text-white/40">Последняя синхронизация</dt><dd className="mt-1 text-xs">{data.integrity.lastSyncAt ? new Date(data.integrity.lastSyncAt).toLocaleString("ru-RU") : "Не выполнялась"}</dd></div>
      </dl></Panel>
      <Panel title="Целостность"><dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-3"><dt>Цепочка аудита</dt><dd><StatusPill status={data.integrity.auditChain.valid === null ? "unknown" : data.integrity.auditChain.valid ? "ready" : "critical"} label={data.integrity.auditChain.valid === null ? "не проверена" : data.integrity.auditChain.valid ? "целостна" : "нарушена"} /></dd></div>
        <div className="flex justify-between gap-3"><dt>Последняя проверка</dt><dd>{data.integrity.latest ? `${data.integrity.latest.status} · ${data.integrity.latest.findingsCount}` : "Не выполнялась"}</dd></div>
        <div className="flex justify-between gap-3"><dt>Orphan consent</dt><dd><StatusPill status="unknown" label="неизвестно" /></dd></div>
        <div className="flex justify-between gap-3"><dt>Orphan quarantine</dt><dd><StatusPill status="unknown" label="неизвестно" /></dd></div>
        <div className="flex justify-between gap-3"><dt>Symlink findings</dt><dd><StatusPill status="unknown" label="неизвестно" /></dd></div>
      </dl></Panel>
    </div>
    <Panel title="Инфраструктура" className="mt-6"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.infrastructure.map((item) => <div key={item.key} className="flex items-start justify-between gap-3 border border-white/10 p-3"><div><div className="text-sm font-semibold">{item.label}</div><div className="mt-1 text-xs text-white/40">{item.detail}</div></div><StatusPill status={item.status} /></div>)}</div>
      <p className="mt-4 border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100"><b>Резервное копирование: частичная готовность.</b> Локальная зашифрованная резервная копия создана и проверена восстановлением. Независимая внешняя резервная копия отсутствует.</p>
    </Panel>
  </InternalShell>;
}
