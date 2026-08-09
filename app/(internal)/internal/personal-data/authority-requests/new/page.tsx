import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { SecureMutationForm } from "@/components/pd-admin/Stage4Forms";
import { Panel } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";

export const dynamic = "force-dynamic";
export default async function NewAuthorityRequestPage() {
  const context = await requirePdPageContext("CREATE_AUTHORITY_REQUEST"); const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; const userId = context.user.id; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Регистрация" title="Новый запрос государственного органа" description="Запись не подтверждает подлинность запроса: проверка полномочий выполняется отдельным действием." /><Panel><SecureMutationForm csrfToken={shell.csrfToken} endpoint="/api/internal/personal-data/authority-requests" submitLabel="Зарегистрировать" successHref="/internal/personal-data/authority-requests/{id}" baseBody={{ responsibleUserId: userId }} fields={[
    { name: "registrationNumber", label: "Внутренний регистрационный номер", required: true }, { name: "receivedAt", label: "Получено", kind: "datetime-local", required: true },
    { name: "authorityName", label: "Наименование органа", required: true }, { name: "department", label: "Подразделение" }, { name: "officialName", label: "Подписант" }, { name: "officialPosition", label: "Должность" },
    { name: "requestNumber", label: "Номер документа", required: true }, { name: "requestDate", label: "Дата документа", kind: "date", required: true },
    { name: "deliveryChannel", label: "Канал получения", required: true }, { name: "confirmedDueAt", label: "Подтверждённый срок ответа", kind: "datetime-local", required: true, help: "Расчёт не учитывает официальные праздничные и перенесённые выходные дни. Для иных органов срок определяется документом или применимой нормой." },
    { name: "dueConfirmationBasis", label: "Основание подтверждения срока", kind: "textarea", required: true, help: "Укажите реквизиты запроса, норму или результат ручной проверки. Техническая дата сохраняется отдельно." },
    { name: "legalBasis", label: "Заявленное правовое основание", kind: "textarea", required: true }, { name: "requestedScope", label: "Точный запрошенный объём", kind: "textarea", required: true },
    { name: "requestIds", label: "Связанные Request ID", kind: "lines" },
  ]} /></Panel></InternalShell>;
}
