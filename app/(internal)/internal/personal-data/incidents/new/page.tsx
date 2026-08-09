import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { SecureMutationForm } from "@/components/pd-admin/Stage4Forms";
import { Panel } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";

export const dynamic = "force-dynamic";
export default async function NewIncidentPage() {
  const context = await requirePdPageContext("CREATE_INCIDENT"); const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; const userId = context.user.id; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Регистрация" title="Новый инцидент" description="Не включайте секреты или избыточные персональные данные. Решение об уведомлении появится только после оценки." /><Panel><SecureMutationForm csrfToken={shell.csrfToken} endpoint="/api/internal/personal-data/incidents" submitLabel="Зарегистрировать" successHref="/internal/personal-data/incidents/{id}" baseBody={{ responsibleUserId: userId }} fields={[{ name: "detectedAt", label: "Выявлен", kind: "datetime-local", required: true }, { name: "description", label: "Описание", kind: "textarea", required: true }, { name: "affectedSystems", label: "Затронутые системы", kind: "textarea", required: true }, { name: "dataCategories", label: "Категории данных", kind: "textarea", required: true }, { name: "estimatedSubjects", label: "Оценка числа субъектов", kind: "number", min: 0 }, { name: "initialMeasures", label: "Первичные меры", kind: "textarea", required: true }, { name: "legalBasis", label: "Основание регистрации", kind: "textarea", required: true }, { name: "requestIds", label: "Связанные Request ID", kind: "lines" }]} /></Panel></InternalShell>;
}
