import {requirePdPageContext} from '@/lib/pd-admin/auth/page-context';
import {InternalShell,InternalPageHeader} from '@/components/pd-admin/InternalShell';
import {EmployeeApp} from '@/components/pd-admin/EmployeeApp';
import {StepUpForm} from '@/components/pd-admin/ActionControls';
export const dynamic='force-dynamic';
export default async function Page(){const c=await requirePdPageContext('MANAGE_USERS');const shell={user:c.user,session:c.session,csrfToken:c.csrfToken};c.close();return <InternalShell {...shell}><InternalPageHeader eyebrow="Приложение" title="Компьютеры сотрудников" description="Активации калькулятора и отключение доступа"/><StepUpForm csrfToken={shell.csrfToken}/><EmployeeApp csrfToken={shell.csrfToken}/></InternalShell>}
