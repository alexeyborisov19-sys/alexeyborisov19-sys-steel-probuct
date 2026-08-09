import { notFound } from "next/navigation";
import { StepUpForm } from "@/components/pd-admin/ActionControls";
import { InternalPageHeader, InternalShell, roleLabels } from "@/components/pd-admin/InternalShell";
import { Panel, StatusPill } from "@/components/pd-admin/Ui";
import { UserActions } from "@/components/pd-admin/UserManagement";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";
import { getUser } from "@/lib/pd-admin/users/repository";

export const dynamic = "force-dynamic";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePdPageContext("MANAGE_USERS"); const user = getUser(context, (await params).id);
  if (!user) { context.close(); notFound(); }
  const stepUp = isStepUpActive(context.session.stepUpUntil); const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Пользователь" title="Учётная запись" description="Опасные действия требуют повторного подтверждения текущего пароля администратора." />
    <Panel><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-white/40">Имя</dt><dd className="mt-1">{user.displayName}</dd></div><div><dt className="text-white/40">Логин</dt><dd className="mt-1">{user.username}</dd></div><div><dt className="text-white/40">Роль</dt><dd className="mt-1">{roleLabels[user.role]}</dd></div><div><dt className="text-white/40">Статус</dt><dd className="mt-1"><StatusPill status={user.isActive ? "ready" : "disabled"} label={user.isActive ? "активен" : "выключен"} /></dd></div><div><dt className="text-white/40">Последний вход</dt><dd className="mt-1">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("ru-RU") : "—"}</dd></div><div><dt className="text-white/40">Заблокирован до</dt><dd className="mt-1">{user.lockedUntil ? new Date(user.lockedUntil).toLocaleString("ru-RU") : "—"}</dd></div></dl></Panel>
    <Panel title={stepUp ? "Управление" : "Повторное подтверждение"} className="mt-4">{stepUp ? <UserActions csrfToken={shell.csrfToken} userId={user.id} currentRole={user.role} isActive={user.isActive} /> : <StepUpForm csrfToken={shell.csrfToken} />}</Panel>
  </InternalShell>;
}
