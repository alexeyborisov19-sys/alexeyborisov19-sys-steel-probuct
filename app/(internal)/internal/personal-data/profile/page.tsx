import Link from "next/link";
import { SessionControls, StepUpForm } from "@/components/pd-admin/ActionControls";
import { InternalPageHeader, InternalShell, roleLabels } from "@/components/pd-admin/InternalShell";
import { Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";
import { listUserSessions } from "@/lib/pd-admin/auth/session-store";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const context = await requirePdPageContext(undefined, { allowPasswordChange: true });
  const sessions = listUserSessions(context.database, context.user.id, context.session.id);
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; context.close();
  if (shell.user.mustChangePassword) {
    return <InternalShell {...shell}><InternalPageHeader eyebrow="Ограниченный доступ" title="Текущая сессия" description="До смены временного пароля доступны только сведения о текущей сессии, смена пароля и выход." />
      <Panel title="Текущая сессия" className="max-w-2xl"><dl className="space-y-3 text-sm"><div className="flex justify-between"><dt className="text-white/40">Сотрудник</dt><dd>{shell.user.displayName}</dd></div><div className="flex justify-between"><dt className="text-white/40">Начало</dt><dd>{new Date(shell.session.createdAt).toLocaleString("ru-RU")}</dd></div><div className="flex justify-between"><dt className="text-white/40">Абсолютное окончание</dt><dd>{new Date(shell.session.absoluteExpiresAt).toLocaleString("ru-RU")}</dd></div></dl><Link prefetch={false} href="/internal/personal-data/change-password" className="mt-5 inline-block text-xs font-semibold text-[#ea5b0c]">Сменить временный пароль</Link></Panel>
    </InternalShell>;
  }
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Профиль" title="Учётная запись и сессии" description="В интерфейсе не отображаются токены, полные IP-хеши и User-Agent-хеши." />
    <div className="grid gap-4 xl:grid-cols-2"><Panel title="Учётная запись"><dl className="space-y-3 text-sm"><div className="flex justify-between"><dt className="text-white/40">Сотрудник</dt><dd>{shell.user.displayName}</dd></div><div className="flex justify-between"><dt className="text-white/40">Роль</dt><dd>{roleLabels[shell.user.role]}</dd></div><div className="flex justify-between"><dt className="text-white/40">Step-up</dt><dd><StatusPill status={isStepUpActive(shell.session.stepUpUntil) ? "ready" : "disabled"} label={isStepUpActive(shell.session.stepUpUntil) ? "активен" : "не активен"} /></dd></div><div className="flex justify-between"><dt className="text-white/40">Абсолютное окончание</dt><dd>{new Date(shell.session.absoluteExpiresAt).toLocaleString("ru-RU")}</dd></div></dl><Link prefetch={false} href="/internal/personal-data/change-password" className="mt-5 inline-block text-xs font-semibold text-[#ea5b0c]">Изменить пароль</Link></Panel>
    <Panel title="Step-up"><StepUpForm csrfToken={shell.csrfToken} /></Panel></div>
    <Panel title="Активные и завершённые сессии" className="mt-4"><SessionControls csrfToken={shell.csrfToken} sessions={sessions} /></Panel>
  </InternalShell>;
}
