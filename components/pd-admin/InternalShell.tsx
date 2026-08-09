import Link from "next/link";
import type { PdAuthenticatedUser } from "@/lib/pd-admin/auth/context";
import { hasPdPermission } from "@/lib/pd-admin/auth/permissions";
import type { StoredSession } from "@/lib/pd-admin/auth/session-store";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";
import { LogoutButton } from "@/components/pd-admin/LogoutButton";

const roleLabels = {
  ADMIN: "Администратор",
  PERSONAL_DATA_OFFICER: "Ответственный за ПДн",
  MANAGER: "Менеджер",
  AUDITOR: "Аудитор",
} as const;

const mainNavigation = [
  ["Обзор", "/internal/personal-data", "VIEW_DASHBOARD"],
  ["Заявки", "/internal/personal-data/leads", "VIEW_MASKED_LEADS"],
  ["Согласия", "/internal/personal-data/consents", "VIEW_CONSENT"],
  ["Журнал доступа", "/internal/personal-data/access-log", "VIEW_ACCESS_LOG"],
  ["Целостность", "/internal/personal-data/integrity", "VIEW_INTEGRITY"],
  ["Пользователи", "/internal/personal-data/users", "MANAGE_USERS"],
] as const;

const disabledNavigation = [
  ["Обращения субъектов", "subject-requests"],
  ["Официальные выгрузки", "exports"],
  ["Удаление", "deletions"],
  ["Инциденты", "incidents"],
  ["Резервные копии", "backups"],
  ["Реестр систем", "systems"],
  ["Юридические документы", "legal-documents"],
] as const;

export function InternalShell({
  user,
  session,
  csrfToken,
  children,
}: {
  user: PdAuthenticatedUser;
  session: StoredSession;
  csrfToken: string;
  children: React.ReactNode;
}) {
  const passwordRestricted = user.mustChangePassword;
  return (
    <div className="min-h-screen bg-[#090b0d] text-white">
      <header className="border-b border-white/10 bg-[#101316]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#ea5b0c]">Сталь Продукт</p>
            <p className="mt-1 text-sm font-semibold">Закрытая система управления ПДн</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/65">
            <div><b className="text-white">{user.displayName}</b><br />{roleLabels[user.role]}</div>
            <div>Сессия до<br /><b className="text-white">{new Date(session.absoluteExpiresAt).toLocaleString("ru-RU")}</b></div>
            <span className={`rounded-full border px-3 py-1 ${isStepUpActive(session.stepUpUntil) ? "border-emerald-500/50 text-emerald-300" : "border-white/15 text-white/50"}`}>
              Step-up: {isStepUpActive(session.stepUpUntil) ? "активен" : "не активен"}
            </span>
            <LogoutButton csrfToken={csrfToken} />
          </div>
        </div>
      </header>
      <div className={`mx-auto grid max-w-[1500px] gap-6 px-5 py-6 lg:px-8 ${passwordRestricted ? "" : "lg:grid-cols-[260px_minmax(0,1fr)]"}`}>
        {!passwordRestricted ? <aside className="self-start border border-white/10 bg-[#111519] lg:sticky lg:top-6">
          <nav aria-label="Служебная навигация" className="p-3">
            {mainNavigation.map(([label, href, permission]) => hasPdPermission(user.role, permission) ? (
              <Link key={href} href={href} prefetch={false} className="block border-b border-white/8 px-3 py-3 text-xs font-semibold transition hover:bg-white/5 hover:text-[#ea5b0c]">
                {label}
              </Link>
            ) : null)}
            <Link href="/internal/personal-data/profile" prefetch={false} className="block border-b border-white/8 px-3 py-3 text-xs font-semibold transition hover:bg-white/5 hover:text-[#ea5b0c]">Профиль</Link>
          </nav>
          <div className="border-t border-white/10 p-3">
            <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[.18em] text-white/35">Следующий этап</p>
            {disabledNavigation.map(([label, slug]) => (
              <Link key={slug} href={`/internal/personal-data/${slug}`} prefetch={false} aria-disabled="true" className="block px-3 py-2 text-[11px] text-white/35">
                {label} <span className="text-[#ea5b0c]/70">· Следующий этап</span>
              </Link>
            ))}
          </div>
        </aside> : null}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

export function InternalPageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <header className="mb-6 border-l-2 border-[#ea5b0c] pl-5">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ea5b0c]">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{title}</h1>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">{description}</p> : null}
    </header>
  );
}

export { roleLabels };
