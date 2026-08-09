import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { SecureMutationForm } from "@/components/pd-admin/Stage4Forms";
import { Panel } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";

export const dynamic = "force-dynamic";
export default async function NewSubjectRequestPage() {
  const context = await requirePdPageContext("CREATE_SUBJECT_REQUEST"); const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; const userId = context.user.id; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Регистрация" title="Новое обращение субъекта" description="Указывайте только необходимый объём данных. Копия паспорта не требуется по умолчанию." /><Panel><SecureMutationForm csrfToken={shell.csrfToken} endpoint="/api/internal/personal-data/subject-requests" submitLabel="Зарегистрировать" successHref="/internal/personal-data/subject-requests/{id}" baseBody={{ responsibleUserId: userId }} fields={[
    { name: "registrationNumber", label: "Регистрационный номер", required: true }, { name: "receivedAt", label: "Дата и время получения", kind: "datetime-local", required: true },
    { name: "channel", label: "Канал", required: true }, { name: "requestType", label: "Тип запроса", kind: "select", options: ["ACCESS", "CLARIFICATION", "BLOCKING", "DELETION", "CONSENT_WITHDRAWAL", "PROCESSING_INFORMATION", "OTHER"].map((value) => ({ value, label: value })) },
    { name: "subjectName", label: "Имя заявителя", required: true }, { name: "subjectContact", label: "Контакт для ответа", required: true },
    { name: "dueAt", label: "Первоначальный срок ответа", kind: "datetime-local", help: "Для типовых запросов срок рассчитывается автоматически, если поле пустое. Производственный календарь и специальное основание нужно проверить вручную." }, { name: "legalBasis", label: "Правовое основание", kind: "textarea", required: true },
    { name: "requestSummary", label: "Содержание обращения", kind: "textarea", required: true }, { name: "requestIds", label: "Связанные Request ID — по одному в строке", kind: "lines", help: "Пустое поле допускается до идентификации и поиска." },
  ]} /></Panel></InternalShell>;
}
