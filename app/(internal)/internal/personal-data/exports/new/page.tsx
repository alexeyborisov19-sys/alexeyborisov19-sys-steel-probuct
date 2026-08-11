import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { SecureMutationForm } from "@/components/pd-admin/Stage4Forms";
import { Panel } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";

export const dynamic = "force-dynamic";
export default async function NewExportPage() {
  const context = await requirePdPageContext("CREATE_EXPORT_DRAFT"); const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; const userId = context.user.id; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Draft" title="Новая выборочная выгрузка" description="Нужны основание, ограничивающий фильтр, категории и ответственный. Телефон и e-mail преобразуются в HMAC до записи фильтра." /><Panel><SecureMutationForm csrfToken={shell.csrfToken} endpoint="/api/internal/personal-data/exports" submitLabel="Создать draft" successHref="/internal/personal-data/exports/{id}" baseBody={{ responsibleUserId: userId, approvingUserId: userId }} fields={[
    { name: "type", label: "Тип", kind: "select", options: ["SUBJECT_REQUEST", "AUTHORITY_REQUEST", "COURT_REQUEST", "LAW_ENFORCEMENT_REQUEST", "INTERNAL_INVESTIGATION", "OTHER"].map((value) => ({ value, label: value })) },
    { name: "requestNumber", label: "Номер запроса", required: true }, { name: "requestDate", label: "Дата запроса", kind: "date", required: true },
    { name: "authorityName", label: "Орган или субъект" }, { name: "legalBasis", label: "Правовое основание", kind: "textarea", required: true },
    { name: "subjectRequestId", label: "Технический ID обращения субъекта" }, { name: "authorityRequestId", label: "Технический ID запроса органа" },
    { name: "requestIds", label: "Request ID — по одному в строке", kind: "lines" }, { name: "phone", label: "Точный телефон (не сохранится открыто)" }, { name: "email", label: "Точный e-mail (не сохранится открыто)" },
    { name: "createdFrom", label: "Период с", kind: "datetime-local" }, { name: "createdTo", label: "Период по", kind: "datetime-local" },
    { name: "categories", label: "Категории", kind: "checkboxes", required: true, options: ["RECORDS", "CONSENT", "ATTACHMENTS", "ACCESS_EVENTS", "WORKFLOW", "COMMENTS", "TECHNICAL_EVENTS"].map((value) => ({ value, label: value })) },
  ]} /></Panel></InternalShell>;
}
