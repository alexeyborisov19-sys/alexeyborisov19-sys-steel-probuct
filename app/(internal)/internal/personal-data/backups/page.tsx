import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { SecureMutationForm } from "@/components/pd-admin/Stage4Forms";
import { EmptyState, MetricCard, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { listBackups } from "@/lib/pd-admin/registers/repository";

export const dynamic = "force-dynamic";

export default async function BackupsPage() {
  const context = await requirePdPageContext("VIEW_BACKUPS");
  const data = listBackups(context) as {
    runs: Array<Record<string, unknown>>;
    restores: Array<Record<string, unknown>>;
    status: Record<string, string>;
  };
  const canManage = ["ADMIN", "PERSONAL_DATA_OFFICER"].includes(context.user.role);
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  context.close();

  return <InternalShell {...shell}>
    <InternalPageHeader
      eyebrow="Устойчивость"
      title="Контроль резервных копий"
      description="Локальная и off-server зашифрованные копии подтверждаются зарегистрированными backup runs и restore tests. Хранение у одного провайдера и в одном аккаунте остаётся отдельным риском."
    />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Локальная encrypted backup" value={data.status.localEncrypted} />
      <MetricCard label="Локальный restore test" value={data.status.localRestore} />
      <MetricCard label="Off-server encrypted" value={data.status.independentOffServer} tone="warning" />
      <MetricCard label="Общий статус" value={data.status.overall} tone="warning" />
    </div>

    {canManage ? <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Panel title="Зарегистрировать выполненную копию">
        <SecureMutationForm
          csrfToken={shell.csrfToken}
          endpoint="/api/internal/personal-data/backups"
          submitLabel="Зарегистрировать"
          baseBody={{ encrypted: true }}
          fields={[
            { name: "startedAt", label: "Начало", kind: "datetime-local", required: true },
            { name: "completedAt", label: "Завершение", kind: "datetime-local" },
            { name: "backupType", label: "Тип", required: true },
            { name: "status", label: "Результат", required: true },
            { name: "destinationType", label: "Тип назначения", required: true, defaultValue: "LOCAL_SAME_VPS" },
            { name: "archiveSha256", label: "SHA-256 архива" },
            { name: "filesCount", label: "Файлов", kind: "number", min: 0 },
            { name: "totalBytes", label: "Байт", kind: "number", min: 0 },
            { name: "failureReason", label: "Ошибка", kind: "textarea" },
            { name: "legalBasis", label: "Основание регистрации", kind: "textarea", required: true },
          ]}
        />
      </Panel>
      {data.runs.length ? <Panel title="Зарегистрировать restore test">
        <SecureMutationForm
          csrfToken={shell.csrfToken}
          endpoint="/api/internal/personal-data/backups/{id}"
          endpointIdField="backupId"
          method="PATCH"
          submitLabel="Зарегистрировать проверку"
          fields={[
            {
              name: "backupId",
              label: "Backup run",
              kind: "select",
              required: true,
              options: data.runs.map((item) => ({
                value: String(item.id),
                label: `${String(item.id).slice(0, 12)}… — ${String(item.started_at)}, версия ${String(item.version)}`,
              })),
            },
            { name: "version", label: "Текущая версия backup run", kind: "number", min: 1, required: true, defaultValue: Number(data.runs[0]?.version || 1), help: "Версия указана в таблице; несовпадение безопасно вернёт CONFLICT." },
            { name: "result", label: "Результат", kind: "select", required: true, options: ["PASS", "PARTIAL", "FAIL"].map((value) => ({ value, label: value })) },
            { name: "filesVerified", label: "Проверено файлов", kind: "number", min: 0 },
            { name: "isolatedTarget", label: "Изолированная цель восстановления", required: true },
            { name: "notes", label: "Примечание", kind: "textarea" },
            { name: "legalBasis", label: "Основание регистрации", kind: "textarea", required: true },
          ]}
        />
      </Panel> : null}
    </div> : null}

    <Panel title="Запуски" className="mt-4">
      {data.runs.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="text-white/40"><tr>{["ID", "Версия", "Дата", "Тип", "Назначение", "Encrypted", "Статус", "Restore", "SHA-256"].map((heading) => <th key={heading} className="border-b border-white/10 px-3 py-3">{heading}</th>)}</tr></thead>
          <tbody>{data.runs.map((item) => <tr key={String(item.id)} className="border-b border-white/5">
            <td className="px-3 py-3">{String(item.id).slice(0, 12)}…</td>
            <td className="px-3 py-3">{String(item.version)}</td>
            <td className="px-3 py-3">{new Date(String(item.started_at)).toLocaleString("ru-RU")}</td>
            <td className="px-3 py-3">{String(item.backup_type)}</td>
            <td className="px-3 py-3">{String(item.destination_type)}</td>
            <td className="px-3 py-3">{item.encrypted ? "Да" : "Нет"}</td>
            <td className="px-3 py-3"><StatusPill status={item.status === "PASS" ? "ready" : "warning"} label={String(item.status)} /></td>
            <td className="px-3 py-3">{String(item.restore_result || "не проверено")}</td>
            <td className="max-w-[180px] break-all px-3 py-3">{String(item.archive_sha256 || "—")}</td>
          </tr>)}</tbody>
        </table>
      </div> : <EmptyState>Запуски не зарегистрированы.</EmptyState>}
    </Panel>
  </InternalShell>;
}
