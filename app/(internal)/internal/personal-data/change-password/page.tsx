import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { PasswordChangeForm } from "@/components/pd-admin/PasswordChangeForm";
import { Panel } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const context = await requirePdPageContext(undefined, { allowPasswordChange: true });
  const props = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  context.close();
  return <InternalShell {...props}><InternalPageHeader eyebrow="Безопасность" title="Смена временного пароля" description="До смены временного пароля остальные разделы недоступны." /><Panel className="max-w-xl"><PasswordChangeForm csrfToken={props.csrfToken} /></Panel></InternalShell>;
}
