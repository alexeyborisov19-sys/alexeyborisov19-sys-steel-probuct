import Link from "next/link";
import { StepUpForm } from "@/components/pd-admin/ActionControls";
import { InternalPageHeader, InternalShell, roleLabels } from "@/components/pd-admin/InternalShell";
import { EmptyState, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { CreateUserForm } from "@/components/pd-admin/UserManagement";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";
import { listUsers } from "@/lib/pd-admin/users/repository";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const context = await requirePdPageContext("MANAGE_USERS");
  const users = listUsers(context); const stepUp = isStepUpActive(context.session.stepUpUntil);
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Доступ" title="Пользователи" description="Каждый сотрудник использует личную учётную запись. Пароли и session tokens не отображаются." />
    {!stepUp ? <Panel title="Требуется step-up" className="mb-4"><StepUpForm csrfToken={shell.csrfToken} /></Panel> : <Panel title="Создать пользователя" className="mb-4"><CreateUserForm csrfToken={shell.csrfToken} /></Panel>}
    <Panel>{users.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="text-white/40"><tr>{["Сотрудник", "Логин", "Роль", "Статус", "Временный пароль", "Последний вход"].map((h) => <th key={h} className="border-b border-white/10 px-3 py-3">{h}</th>)}</tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-white/5"><td className="px-3 py-3"><Link prefetch={false} href={`/internal/personal-data/users/${user.id}`} className="font-semibold text-[#ea5b0c]">{user.displayName}</Link></td><td className="px-3 py-3">{user.username}</td><td className="px-3 py-3">{roleLabels[user.role]}</td><td className="px-3 py-3"><StatusPill status={user.isActive ? user.lockedUntil ? "warning" : "ready" : "disabled"} label={user.isActive ? user.lockedUntil ? "заблокирован" : "активен" : "выключен"} /></td><td className="px-3 py-3">{user.mustChangePassword ? "Нужно сменить" : "Нет"}</td><td className="px-3 py-3">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("ru-RU") : "—"}</td></tr>)}</tbody></table></div> : <EmptyState>Пользователей нет.</EmptyState>}</Panel>
  </InternalShell>;
}
